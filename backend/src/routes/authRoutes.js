const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const {
  checkDomain,
  syncProfile,
  getMe,
  logout,
} = require("../controllers/authController");

const router = express.Router();

router.get("/check-domain", asyncHandler(checkDomain));
router.post("/profile", requireAuth, asyncHandler(syncProfile));
router.get("/me", requireAuth, asyncHandler(getMe));
router.post("/logout", requireAuth, asyncHandler(logout));

module.exports = router;
