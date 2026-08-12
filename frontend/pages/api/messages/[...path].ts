import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";
const { getMessages, sendMessage } = require("../../../backend/src/controllers/messageController");

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUser(req, res);
  if (!user) return;
  (req as any).user = user;

  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [path || ""];
  const missionId = segments[0];

  if (!missionId) return res.status(404).json({ error: "Not found" });
  req.params = { missionId } as any;

  try {
    if (req.method === "GET") return await getMessages(req, res);
    if (req.method === "POST") return await sendMessage(req, res);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("[/api/messages]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
