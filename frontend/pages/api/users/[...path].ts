import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";

const {
  createUser,
  getUser,
  getLockStatus,
  updateUser,
  getLeaderboard,
  getUserHeat,
  getPublicProfile,
  searchUsers,
} = require("../../../backend/src/controllers/userController");

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // All user routes require auth
  const user = await getAuthUser(req, res);
  if (!user) return;
  (req as any).user = user;

  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [path || ""];

  try {
    // GET /api/users/search
    if (req.method === "GET" && segments[0] === "search") {
      return await searchUsers(req, res);
    }
    // GET /api/users/leaderboard
    if (req.method === "GET" && segments[0] === "leaderboard") {
      return await getLeaderboard(req, res);
    }
    // POST /api/users/
    if (req.method === "POST" && segments.length === 0) {
      return await createUser(req, res);
    }
    // Routes with :id
    if (segments[0]) {
      req.params = { id: segments[0] } as any;

      // GET /api/users/:id/lock
      if (req.method === "GET" && segments[1] === "lock") {
        return await getLockStatus(req, res);
      }
      // GET /api/users/:id/heat
      if (req.method === "GET" && segments[1] === "heat") {
        return await getUserHeat(req, res);
      }
      // GET /api/users/:id/public
      if (req.method === "GET" && segments[1] === "public") {
        return await getPublicProfile(req, res);
      }
      // GET /api/users/:id
      if (req.method === "GET" && !segments[1]) {
        return await getUser(req, res);
      }
      // PUT /api/users/:id
      if (req.method === "PUT" && !segments[1]) {
        return await updateUser(req, res);
      }
    }

    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("[/api/users]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
