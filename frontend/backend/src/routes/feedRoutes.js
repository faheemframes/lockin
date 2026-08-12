const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { getFeed, getUserFeed, getLiveActivities } = require("../controllers/feedController");

const router = express.Router();

router.get("/", asyncHandler(getFeed));
router.get("/live", asyncHandler(getLiveActivities));
router.get("/user/:userId", asyncHandler(getUserFeed));

module.exports = router;
