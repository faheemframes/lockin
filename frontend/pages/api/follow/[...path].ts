import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus,
} = require("../../../backend/src/controllers/followController");

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUser(req, res);
  if (!user) return;
  (req as any).user = user;

  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [path || ""];

  try {
    // POST /api/follow/
    if (req.method === "POST" && !segments[0]) return await followUser(req, res);
    // DELETE /api/follow/
    if (req.method === "DELETE" && !segments[0]) return await unfollowUser(req, res);
    // GET /api/follow/status
    if (req.method === "GET" && segments[0] === "status") return await getFollowStatus(req, res);
    // GET /api/follow/:userId/followers
    if (req.method === "GET" && segments[0] && segments[1] === "followers") {
      req.params = { userId: segments[0] } as any;
      return await getFollowers(req, res);
    }
    // GET /api/follow/:userId/following
    if (req.method === "GET" && segments[0] && segments[1] === "following") {
      req.params = { userId: segments[0] } as any;
      return await getFollowing(req, res);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("[/api/follow]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
