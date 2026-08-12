const prisma = require("../config/db");
const { isDbUnavailable } = require("../utils/dbFallback");

// GET /api/tasks/mission/:missionId
async function getTasksForMission(req, res) {
  const missionId = Number(req.params.missionId);
  if (isNaN(missionId)) {
    return res.status(400).json({ error: "Invalid missionId." });
  }

  try {
    const tasks = await prisma.task.findMany({
      where: { missionId },
      orderBy: { position: "asc" }
    });
    res.json(tasks);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning empty array for tasks.");
      res.json([]);
      return;
    }
    console.error("Error fetching tasks for mission", error);
    res.status(500).json({ error: "Failed to load tasks." });
  }
}

// POST /api/tasks
async function createTask(req, res) {
  const { title, missionId, position } = req.body;
  if (!title || !missionId) {
    return res.status(400).json({ error: "title and missionId are required." });
  }

  const numericMissionId = Number(missionId);
  const numericPosition = position !== undefined ? Number(position) : 0;

  try {
    const task = await prisma.task.create({
      data: {
        title,
        missionId: numericMissionId,
        position: numericPosition
      }
    });
    res.status(201).json(task);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock created task.");
      res.status(201).json({
        id: Math.floor(Math.random() * 1000) + 1000,
        title,
        completed: false,
        position: numericPosition,
        missionId: numericMissionId,
        completedAt: null,
        createdAt: new Date().toISOString()
      });
      return;
    }
    console.error("Error creating task", error);
    res.status(500).json({ error: "Failed to create task." });
  }
}

// POST /api/tasks/batch
async function createBatchTasks(req, res) {
  const { tasks, missionId } = req.body;
  if (!Array.isArray(tasks) || !missionId) {
    return res.status(400).json({ error: "tasks array and missionId are required." });
  }

  const numericMissionId = Number(missionId);

  try {
    // Create multiple tasks
    const taskData = tasks.map((t, idx) => ({
      title: t.title,
      position: t.position !== undefined ? Number(t.position) : idx,
      missionId: numericMissionId
    }));

    // prisma.task.createMany is supported in PostgreSQL
    await prisma.task.createMany({
      data: taskData
    });

    const createdTasks = await prisma.task.findMany({
      where: { missionId: numericMissionId },
      orderBy: { position: "asc" }
    });

    res.status(201).json(createdTasks);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock batch tasks.");
      const mockTasks = tasks.map((t, idx) => ({
        id: Math.floor(Math.random() * 1000) + 1000 + idx,
        title: t.title,
        completed: false,
        position: t.position !== undefined ? Number(t.position) : idx,
        missionId: numericMissionId,
        completedAt: null,
        createdAt: new Date().toISOString()
      }));
      res.status(201).json(mockTasks);
      return;
    }
    console.error("Error batch creating tasks", error);
    res.status(500).json({ error: "Failed to create tasks." });
  }
}

// PUT /api/tasks/:id/toggle
async function toggleTask(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid task ID." });
  }

  try {
    const currentTask = await prisma.task.findUnique({
      where: { id }
    });

    if (!currentTask) {
      return res.status(404).json({ error: "Task not found." });
    }

    const nextCompleted = !currentTask.completed;
    const completedAt = nextCompleted ? new Date() : null;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        completed: nextCompleted,
        completedAt
      }
    });

    res.json(updatedTask);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock toggled task.");
      res.json({
        id,
        title: "Mock Task",
        completed: true,
        position: 0,
        missionId: 1,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      return;
    }
    console.error("Error toggling task", error);
    res.status(500).json({ error: "Failed to toggle task." });
  }
}

// DELETE /api/tasks/:id
async function deleteTask(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid task ID." });
  }

  try {
    await prisma.task.delete({
      where: { id }
    });
    res.json({ message: "Task deleted successfully." });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Simulating successful task delete.");
      res.json({ message: "Task deleted successfully." });
      return;
    }
    console.error("Error deleting task", error);
    res.status(500).json({ error: "Failed to delete task." });
  }
}

module.exports = {
  getTasksForMission,
  createTask,
  createBatchTasks,
  toggleTask,
  deleteTask
};
