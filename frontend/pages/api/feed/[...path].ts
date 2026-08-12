import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";
const { getFeed, getLiveActivities, getUserFeed } = require("../../../backend/src/controllers/feedController");

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUser(req, res);
  if (!user) return;
  (req as any).user = user;

  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [path || ""];

  try {
    // GET /api/feed/live
    if (req.method === "GET" && segments[0] === "live") return await getLiveActivities(req, res);
    // GET /api/feed/user/:userId
    if (req.method === "GET" && segments[0] === "user" && segments[1]) {
      req.params = { userId: segments[1] } as any;
      return await getUserFeed(req, res);
    }
    // GET /api/feed/
    if (req.method === "GET") return await getFeed(req, res);

    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("[/api/feed]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
