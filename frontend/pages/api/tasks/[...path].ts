import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "../../../lib/requireAuth";
const {
  getTasksForMission,
  createTask,
  createBatchTasks,
  toggleTask,
  deleteTask,
} = require("../../../backend/src/controllers/taskController");

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUser(req, res);
  if (!user) return;
  (req as any).user = user;

  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [path || ""];

  try {
    // GET /api/tasks/mission/:missionId
    if (req.method === "GET" && segments[0] === "mission" && segments[1]) {
      req.params = { missionId: segments[1] } as any;
      return await getTasksForMission(req, res);
    }
    // POST /api/tasks/batch
    if (req.method === "POST" && segments[0] === "batch") {
      return await createBatchTasks(req, res);
    }
    // POST /api/tasks/
    if (req.method === "POST" && !segments[0]) {
      return await createTask(req, res);
    }
    // PUT /api/tasks/:id/toggle
    if (req.method === "PUT" && segments[0] && segments[1] === "toggle") {
      req.params = { id: segments[0] } as any;
      return await toggleTask(req, res);
    }
    // DELETE /api/tasks/:id
    if (req.method === "DELETE" && segments[0]) {
      req.params = { id: segments[0] } as any;
      return await deleteTask(req, res);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("[/api/tasks]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
