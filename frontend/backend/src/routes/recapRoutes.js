const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  finishSession,
  generatePeriodRecap,
  getUserRecaps,
  getMissionRecap,
  getPublicShareRecap
} = require("../controllers/recapController");

const router = express.Router();

// Simple in-memory rate limiter for public route (max 30 requests per minute per IP)
const ipRequestCounts = {};
setInterval(() => {
  // Clear every minute
  for (const key in ipRequestCounts) {
    delete ipRequestCounts[key];
  }
}, 60000);

function rateLimit(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  ipRequestCounts[ip] = (ipRequestCounts[ip] || 0) + 1;
  if (ipRequestCounts[ip] > 30) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }
  next();
}

// Wrapped/Recap generation route (Weekly, Monthly, Yearly)
router.post("/generate", asyncHandler(generatePeriodRecap));

// Historical lookup routes
router.get("/user/:userId", asyncHandler(getUserRecaps));
router.get("/mission/:missionId/user/:userId", asyncHandler(getMissionRecap));

// Rate-limited public share route
router.get("/share/:shareId", rateLimit, asyncHandler(getPublicShareRecap));

module.exports = router;
