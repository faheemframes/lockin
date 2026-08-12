const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  getInterestCategories,
  saveInterests,
  getUserInterests,
  updateUserInterests
} = require("../controllers/interestController");

const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/categories", asyncHandler(getInterestCategories));
router.post("/", requireAuth, asyncHandler(saveInterests));
router.get("/:userId", requireAuth, asyncHandler(getUserInterests));
router.put("/:userId", requireAuth, asyncHandler(updateUserInterests));

module.exports = router;
