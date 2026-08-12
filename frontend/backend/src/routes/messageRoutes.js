const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { getMessages, sendMessage } = require("../controllers/messageController");

const router = express.Router();

router.get("/:missionId", asyncHandler(getMessages));
router.post("/:missionId", asyncHandler(sendMessage));

module.exports = router;

