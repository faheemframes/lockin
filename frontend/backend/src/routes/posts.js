const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  createPost,
  getPostsFeed,
  getPostDetail,
  toggleReaction,
  addComment,
  deletePost
} = require("../controllers/postController");

const router = express.Router();

// Create new social feed post
router.post("/", asyncHandler(createPost));

// Fetch post feed with college/following/everyone filters
router.get("/feed", asyncHandler(getPostsFeed));

// Fetch specific post detail with comments and reaction checks
router.get("/:id", asyncHandler(getPostDetail));

// Toggle reactions on a post
router.post("/:id/react", asyncHandler(toggleReaction));

// Add a comment to a post
router.post("/:id/comments", asyncHandler(addComment));

// Delete a post
router.delete("/:id", asyncHandler(deletePost));

module.exports = router;
