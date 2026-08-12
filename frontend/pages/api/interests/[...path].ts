import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";
const {
  getInterestCategories,
  saveInterests,
  getUserInterests,
  updateUserInterests,
} = require("../../../backend/src/controllers/interestController");

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [path || ""];

  try {
    // GET /api/interests/categories — public
    if (req.method === "GET" && segments[0] === "categories") {
      return await getInterestCategories(req, res);
    }

    // All other interest routes require auth
    const user = await getAuthUser(req, res);
    if (!user) return;
    (req as any).user = user;

    // POST /api/interests/
    if (req.method === "POST" && !segments[0]) return await saveInterests(req, res);
    // GET /api/interests/:userId
    if (req.method === "GET" && segments[0]) {
      req.params = { userId: segments[0] } as any;
      return await getUserInterests(req, res);
    }
    // PUT /api/interests/:userId
    if (req.method === "PUT" && segments[0]) {
      req.params = { userId: segments[0] } as any;
      return await updateUserInterests(req, res);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("[/api/interests]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
