import type { NextApiRequest, NextApiResponse } from "next";

// This catch-all no longer routes to Express.
// All routes are now native Next.js API handlers under pages/api/.
// If you see this response, a route was not matched by any handler.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(404).json({ error: "API route not found. Check your request path." });
}
