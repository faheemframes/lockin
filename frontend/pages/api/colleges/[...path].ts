import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";
const {
  listColleges,
  searchColleges,
  detectCollege,
  getCollegeTypes,
} = require("../../../backend/src/controllers/collegeController");

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUser(req, res);
  if (!user) return;
  (req as any).user = user;

  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [path || ""];

  try {
    if (req.method === "GET" && segments[0] === "search") return await searchColleges(req, res);
    if (req.method === "GET" && segments[0] === "detect") return await detectCollege(req, res);
    if (req.method === "GET" && segments[0] === "types") return await getCollegeTypes(req, res);
    if (req.method === "GET" && !segments[0]) return await listColleges(req, res);

    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("[/api/colleges]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
