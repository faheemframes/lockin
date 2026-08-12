const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  createUser,
  getUser,
  getLockStatus,
  updateUser,
  getLeaderboard,
  getUserHeat,
  getPublicProfile,
  searchUsers
} = require("../controllers/userController");

const router = express.Router();

router.post("/", asyncHandler(createUser));
router.get("/search", asyncHandler(searchUsers));
router.get("/leaderboard", asyncHandler(getLeaderboard));
router.get("/:id", asyncHandler(getUser));
router.get("/:id/lock", asyncHandler(getLockStatus));
router.get("/:id/heat", asyncHandler(getUserHeat));
router.get("/:id/public", asyncHandler(getPublicProfile));
router.put("/:id", asyncHandler(updateUser));

module.exports = router;

