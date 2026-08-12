const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  getTasksForMission,
  createTask,
  createBatchTasks,
  toggleTask,
  deleteTask
} = require("../controllers/taskController");

const router = express.Router();

router.get("/mission/:missionId", asyncHandler(getTasksForMission));
router.post("/", asyncHandler(createTask));
router.post("/batch", asyncHandler(createBatchTasks));
router.put("/:id/toggle", asyncHandler(toggleTask));
router.delete("/:id", asyncHandler(deleteTask));

module.exports = router;
