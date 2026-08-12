import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";
const {
  createPost,
  getPostsFeed,
  getPostDetail,
  toggleReaction,
  addComment,
  deletePost,
} = require("../../../backend/src/controllers/postController");

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUser(req, res);
  if (!user) return;
  (req as any).user = user;

  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [path || ""];

  try {
    // POST /api/posts/
    if (req.method === "POST" && !segments[0]) return await createPost(req, res);
    // GET /api/posts/feed
    if (req.method === "GET" && segments[0] === "feed") return await getPostsFeed(req, res);

    // Routes with :id
    if (segments[0]) {
      req.params = { id: segments[0] } as any;
      if (req.method === "GET" && !segments[1]) return await getPostDetail(req, res);
      if (req.method === "POST" && segments[1] === "react") return await toggleReaction(req, res);
      if (req.method === "POST" && segments[1] === "comments") return await addComment(req, res);
      if (req.method === "DELETE" && !segments[1]) return await deletePost(req, res);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("[/api/posts]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
