const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus
} = require("../controllers/followController");

const router = express.Router();

router.post("/", asyncHandler(followUser));
router.delete("/", asyncHandler(unfollowUser));
router.get("/status", asyncHandler(getFollowStatus));
router.get("/:userId/followers", asyncHandler(getFollowers));
router.get("/:userId/following", asyncHandler(getFollowing));

module.exports = router;
