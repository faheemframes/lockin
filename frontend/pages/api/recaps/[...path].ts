import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";
const {
  generatePeriodRecap,
  getUserRecaps,
  getMissionRecap,
  getPublicShareRecap,
} = require("../../../backend/src/controllers/recapController");

export const config = { api: { bodyParser: true } };

// Simple in-memory rate limiter for the public share route
const ipCounts: Record<string, number> = {};
setInterval(() => { for (const k in ipCounts) delete ipCounts[k]; }, 60_000);

function isRateLimited(req: NextApiRequest): boolean {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || "unknown";
  ipCounts[ip] = (ipCounts[ip] || 0) + 1;
  return ipCounts[ip] > 30;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [path || ""];

  try {
    // GET /api/recaps/share/:shareId — public (no auth), rate-limited
    if (req.method === "GET" && segments[0] === "share" && segments[1]) {
      if (isRateLimited(req)) return res.status(429).json({ error: "Too many requests." });
      req.params = { shareId: segments[1] } as any;
      return await getPublicShareRecap(req, res);
    }

    // All remaining recap routes require auth
    const user = await getAuthUser(req, res);
    if (!user) return;
    (req as any).user = user;

    // POST /api/recaps/generate
    if (req.method === "POST" && segments[0] === "generate") {
      return await generatePeriodRecap(req, res);
    }
    // GET /api/recaps/user/:userId
    if (req.method === "GET" && segments[0] === "user" && segments[1]) {
      req.params = { userId: segments[1] } as any;
      return await getUserRecaps(req, res);
    }
    // GET /api/recaps/mission/:missionId/user/:userId
    if (req.method === "GET" && segments[0] === "mission" && segments[1] && segments[2] === "user" && segments[3]) {
      req.params = { missionId: segments[1], userId: segments[3] } as any;
      return await getMissionRecap(req, res);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("[/api/recaps]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
