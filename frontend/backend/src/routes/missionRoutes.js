const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
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
  submitVibeCheck
} = require("../controllers/missionController");
const { finishSession } = require("../controllers/recapController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, asyncHandler(createMission));
router.get("/categories", asyncHandler(getCategories));
router.get("/campuses", asyncHandler(getCampuses));
router.get("/feed", requireAuth, asyncHandler(getMissionFeed));
router.get("/active/:userId", requireAuth, asyncHandler(getActiveMissions));
router.post("/:id/accept", requireAuth, asyncHandler(acceptMission));
router.post("/:id/pass", requireAuth, asyncHandler(passMission));
router.post("/:id/attendance", requireAuth, asyncHandler(submitAttendance));
router.post("/:id/finish", requireAuth, asyncHandler(finishSession));
router.post("/:id/vibe-check", requireAuth, asyncHandler(submitVibeCheck));
router.post("/:id/approve-participant", requireAuth, asyncHandler(approveParticipant));

module.exports = router;

