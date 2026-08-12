const prisma = require("../config/db");
const { isDbUnavailable } = require("../utils/dbFallback");

/**
 * GET /api/interests/categories
 * Returns all categories available for interest selection
 */
async function getInterestCategories(req, res) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" }
    });

    res.json(
      categories.map((c) => ({
        id: c.id,
        name: c.categoryName,
        emoji: null,
        color: c.colorHex || "#a1a1aa"
      }))
    );
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    // Fallback categories
    res.json([
      { id: 1, name: "Coding", emoji: null, color: "#3b82f6" },
      { id: 2, name: "AI", emoji: null, color: "#8b5cf6" },
      { id: 3, name: "Startups", emoji: null, color: "#f59e0b" },
      { id: 4, name: "Hackathons", emoji: null, color: "#ef4444" },
      { id: 5, name: "Open Source", emoji: null, color: "#10b981" },
      { id: 6, name: "Design", emoji: null, color: "#ec4899" },
      { id: 7, name: "Content Creation", emoji: null, color: "#f97316" },
      { id: 8, name: "Fitness", emoji: null, color: "#14b8a6" },
      { id: 9, name: "Study Sessions", emoji: null, color: "#6366f1" },
      { id: 10, name: "Research", emoji: null, color: "#0ea5e9" },
      { id: 11, name: "Placements", emoji: null, color: "#e11d48" },
      { id: 12, name: "Competitive Programming", emoji: null, color: "#eab308" },
      { id: 13, name: "Reading", emoji: null, color: "#a855f7" },
      { id: 14, name: "Languages", emoji: null, color: "#06b6d4" },
      { id: 15, name: "Career", emoji: null, color: "#64748b" },
      { id: 16, name: "Projects", emoji: null, color: "#f43f5e" },
      { id: 17, name: "Networking", emoji: null, color: "#22c55e" },
      { id: 18, name: "Events", emoji: null, color: "#d946ef" },
      { id: 19, name: "Other", emoji: null, color: "#a1a1aa" }
    ]);
  }
}

/**
 * POST /api/interests
 * Save user's selected interests
 * Body: { userId: number, categoryIds: number[] }
 */
async function saveInterests(req, res) {
  const { userId, categoryIds } = req.body;

  if (!userId || !Array.isArray(categoryIds)) {
    return res.status(400).json({ error: "userId and categoryIds array are required." });
  }

  try {
    // Delete existing interests for this user
    await prisma.userInterest.deleteMany({
      where: { userId: Number(userId) }
    });

    // Create new interests
    if (categoryIds.length > 0) {
      await prisma.userInterest.createMany({
        data: categoryIds.map((catId) => ({
          userId: Number(userId),
          categoryId: Number(catId)
        }))
      });
    }

    // Also update the legacy interests string on the User model for backward compatibility
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds.map(Number) } }
    });
    const interestsString = categories.map((c) => c.categoryName).join(", ");

    await prisma.user.update({
      where: { id: Number(userId) },
      data: { interests: interestsString }
    });

    // Fetch and return the saved interests
    const savedInterests = await prisma.userInterest.findMany({
      where: { userId: Number(userId) },
      include: { category: true },
      orderBy: { categoryId: "asc" }
    });

    res.json(
      savedInterests.map((ui) => ({
        id: ui.category.id,
        name: ui.category.categoryName,
        emoji: null,
        color: ui.category.colorHex || "#a1a1aa"
      }))
    );
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.status(500).json({ error: "Failed to save interests." });
  }
}

/**
 * GET /api/interests/:userId
 * Get a user's interests
 */
async function getUserInterests(req, res) {
  const userId = Number(req.params.userId);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID." });
  }

  try {
    const interests = await prisma.userInterest.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { categoryId: "asc" }
    });

    res.json(
      interests.map((ui) => ({
        id: ui.category.id,
        name: ui.category.categoryName,
        emoji: null,
        color: ui.category.colorHex || "#a1a1aa"
      }))
    );
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json([]);
  }
}

/**
 * PUT /api/interests/:userId
 * Update a user's interests (replace all)
 * Body: { categoryIds: number[] }
 */
async function updateUserInterests(req, res) {
  const userId = Number(req.params.userId);
  const { categoryIds } = req.body;

  if (isNaN(userId) || !Array.isArray(categoryIds)) {
    return res.status(400).json({ error: "Valid userId and categoryIds array are required." });
  }

  // Delegate to saveInterests logic
  req.body.userId = userId;
  return saveInterests(req, res);
}

module.exports = {
  getInterestCategories,
  saveInterests,
  getUserInterests,
  updateUserInterests
};
