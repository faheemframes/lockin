import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";
const { checkDomain } = require("../../../backend/src/controllers/authController");
const { syncProfile } = require("../../../backend/src/controllers/authController");
const { getMe } = require("../../../backend/src/controllers/authController");
const { logout } = require("../../../backend/src/controllers/authController");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const route = Array.isArray(path) ? path.join("/") : path || "";

  try {
    if (req.method === "GET" && route === "check-domain") {
      return await checkDomain(req, res);
    }

    if (req.method === "POST" && route === "profile") {
      const user = await getAuthUser(req, res);
      if (!user) return;
      (req as any).supabaseUser = user;
      return await syncProfile(req, res);
    }

    if (req.method === "GET" && route === "me") {
      const user = await getAuthUser(req, res);
      if (!user) return;
      (req as any).supabaseUser = user;
      return await getMe(req, res);
    }

    if (req.method === "POST" && route === "logout") {
      const user = await getAuthUser(req, res);
      if (!user) return;
      (req as any).supabaseUser = user;
      return await logout(req, res);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("[/api/auth]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
