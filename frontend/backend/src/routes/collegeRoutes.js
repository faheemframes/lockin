const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  listColleges,
  searchColleges,
  detectCollege,
  getCollegeTypes
} = require("../controllers/collegeController");

const router = express.Router();

router.get("/", asyncHandler(listColleges));
router.get("/search", asyncHandler(searchColleges));
router.get("/detect", asyncHandler(detectCollege));
router.get("/types", asyncHandler(getCollegeTypes));

module.exports = router;
