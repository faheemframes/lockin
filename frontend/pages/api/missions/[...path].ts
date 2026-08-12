import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";

const {
  createMission,
  getMissionFeed,
  acceptMission,
  passMission,
  getActiveMissions,
  submitAttendance,
  approveParticipant,
  getCategories,
  getCampuses,
  submitVibeCheck,
} = require("../../../backend/src/controllers/missionController");
const { finishSession } = require("../../../backend/src/controllers/recapController");

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [path || ""];

  try {
    // --- PUBLIC routes (no auth required) ---
    if (req.method === "GET" && segments[0] === "categories") {
      return await getCategories(req, res);
    }
    if (req.method === "GET" && segments[0] === "campuses") {
      return await getCampuses(req, res);
    }

    // --- AUTH required for all remaining routes ---
    const user = await getAuthUser(req, res);
    if (!user) return;
    (req as any).user = user;

    // POST /api/missions/
    if (req.method === "POST" && !segments[0]) {
      return await createMission(req, res);
    }
    // GET /api/missions/feed
    if (req.method === "GET" && segments[0] === "feed") {
      return await getMissionFeed(req, res);
    }
    // GET /api/missions/active/:userId
    if (req.method === "GET" && segments[0] === "active" && segments[1]) {
      req.params = { userId: segments[1] } as any;
      return await getActiveMissions(req, res);
    }
    // Routes with :id
    if (segments[0]) {
      const id = segments[0];
      req.params = { id } as any;

      if (req.method === "POST" && segments[1] === "accept") {
        return await acceptMission(req, res);
      }
      if (req.method === "POST" && segments[1] === "pass") {
        return await passMission(req, res);
      }
      if (req.method === "POST" && segments[1] === "attendance") {
        return await submitAttendance(req, res);
      }
      if (req.method === "POST" && segments[1] === "finish") {
        return await finishSession(req, res);
      }
      if (req.method === "POST" && segments[1] === "vibe-check") {
        return await submitVibeCheck(req, res);
      }
      if (req.method === "POST" && segments[1] === "approve-participant") {
        return await approveParticipant(req, res);
      }
    }

    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("[/api/missions]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
