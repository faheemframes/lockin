import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const prisma = require("../backend/src/config/db");
const { forceIdentity } = require("../backend/src/utils/security");

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

/**
 * Demo login is a local-development convenience only. It needs an explicit
 * opt-in and can never be enabled in a production build.
 */
export const DEMO_LOGIN_ENABLED = process.env.ENABLE_DEMO_LOGIN === "true" && process.env.NODE_ENV !== "production";
const DEMO_USER_ID = Number(process.env.DEMO_USER_ID || 101);

/*
 * Token verification cache. Every API call used to ask Supabase Auth who the
 * token belongs to; a page opens several calls at once, so the same token was
 * verified over the network again and again. A verified token is remembered
 * for a short time (never past its own expiry) on this server instance.
 */
type VerifiedUser = { id: string; email?: string; email_confirmed_at?: string | null };
const TOKEN_TTL_MS = 60_000;
const TOKEN_CACHE_MAX = 1000;
const tokenCache = new Map<string, { user: VerifiedUser; until: number }>();

function tokenExpiryMs(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** Drop a token from the cache (on logout). */
export function forgetToken(authHeader: string | undefined) {
  if (authHeader?.startsWith("Bearer ")) tokenCache.delete(authHeader.slice(7).trim());
}

async function verifyToken(token: string): Promise<VerifiedUser | null> {
  const now = Date.now();
  const hit = tokenCache.get(token);
  if (hit && hit.until > now) return hit.user;
  if (hit) tokenCache.delete(token);

  const { data, error } = await supabase!.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return null;

  const until = Math.min(now + TOKEN_TTL_MS, tokenExpiryMs(token) || now);
  if (until > now) {
    if (tokenCache.size >= TOKEN_CACHE_MAX) {
      const oldest = tokenCache.keys().next().value;
      if (oldest !== undefined) tokenCache.delete(oldest);
    }
    tokenCache.set(token, { user: { id: user.id, email: user.email, email_confirmed_at: user.email_confirmed_at }, until });
  }
  return user;
}

/** true/false if known; null if it can't be checked (then we fail closed). */
async function authAccountExists(supabaseId: string): Promise<boolean | null> {
  if (!/^[0-9a-f-]{36}$/i.test(supabaseId)) return null;
  try {
    const rows = await prisma.$queryRaw`select 1 from auth.users where id = ${supabaseId}::uuid limit 1`;
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return null;
  }
}

export interface AuthedUser {
  /** Supabase auth user id (uuid), or "demo". */
  authId: string;
  email: string;
  /** Our database user id. Null only when `profile: false` and no profile exists yet. */
  userId: number | null;
  dbUser: any | null;
}

/**
 * Authenticate the request from its Bearer token.
 *
 * - Verifies the token with Supabase and requires a confirmed email.
 * - Resolves exactly one database user (by supabase_id; links by email only
 *   when that row has never been linked to another auth account).
 * - Overwrites every identity field in body/query with the session user, so
 *   controllers can never act on behalf of someone else.
 *
 * Sends the error response itself and returns null on failure.
 */
export async function getAuthUser(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: { profile?: boolean } = {}
): Promise<AuthedUser | null> {
  const requireProfile = opts.profile !== false;
  const authHeader = req.headers.authorization || "";

  if (DEMO_LOGIN_ENABLED && authHeader === "Bearer demo-token") {
    const dbUser = await prisma.user.findUnique({ where: { id: DEMO_USER_ID }, include: { collegeRef: true } });
    if (!dbUser) {
      res.status(401).json({ error: "Demo user not found. Seed the database first." });
      return null;
    }
    return attach(req, { authId: "demo", email: dbUser.email || "", userId: dbUser.id, dbUser });
  }

  if (!supabase) {
    res.status(503).json({ error: "Sign-in is not configured on this server." });
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.length > 4096) {
    res.status(401).json({ error: "Invalid or expired session token." });
    return null;
  }

  const authUser = await verifyToken(token);
  if (!authUser) {
    res.status(401).json({ error: "Invalid or expired session token." });
    return null;
  }
  if (!authUser.email || !authUser.email_confirmed_at) {
    res.status(403).json({ error: "Confirm your email address before continuing." });
    return null;
  }

  const email = authUser.email.trim().toLowerCase();
  let dbUser = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { collegeRef: true } });

  if (!dbUser) {
    const byEmail = await prisma.user.findUnique({ where: { email }, include: { collegeRef: true } });
    if (byEmail && byEmail.supabaseId && byEmail.supabaseId !== authUser.id) {
      // That email's profile is linked to a different auth account. If that
      // account still exists, never merge. If it was deleted (and this verified
      // email signed up again), the profile would otherwise be lost for good:
      // re-link it to the new auth account.
      const previousExists = await authAccountExists(byEmail.supabaseId);
      if (previousExists !== false) {
        res.status(403).json({ error: "This email is linked to another account." });
        return null;
      }
      dbUser = await prisma.user.update({
        where: { id: byEmail.id },
        data: { supabaseId: authUser.id, emailVerified: true },
        include: { collegeRef: true }
      });
    }
    if (byEmail && !byEmail.supabaseId) {
      dbUser = await prisma.user.update({
        where: { id: byEmail.id },
        data: { supabaseId: authUser.id, emailVerified: true, verifiedAt: byEmail.verifiedAt || new Date() },
        include: { collegeRef: true }
      });
    }
  }

  if (!dbUser && requireProfile) {
    res.status(403).json({ error: "Finish setting up your profile first." });
    return null;
  }

  return attach(req, { authId: authUser.id, email, userId: dbUser ? dbUser.id : null, dbUser });
}

function attach(req: NextApiRequest, user: AuthedUser): AuthedUser {
  const r = req as any;
  r.supabaseUser = { id: user.authId, email: user.email };
  r.user = user.dbUser;
  r.userId = user.userId;
  if (user.userId) forceIdentity(req, user.userId);
  return user;
}

export { supabase };
