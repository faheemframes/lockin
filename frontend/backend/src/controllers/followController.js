const prisma = require("../config/db");
const { isDbUnavailable } = require("../utils/dbFallback");

// POST /api/follow
async function followUser(req, res) {
  const { followerId, followingId } = req.body;
  if (!followerId || !followingId) {
    return res.status(400).json({ error: "followerId and followingId are required." });
  }

  const numericFollower = Number(followerId);
  const numericFollowing = Number(followingId);

  if (numericFollower === numericFollowing) {
    return res.status(400).json({ error: "You cannot follow yourself." });
  }

  try {
    const follow = await prisma.follow.create({
      data: {
        followerId: numericFollower,
        followingId: numericFollowing
      }
    });
    res.status(201).json(follow);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock follow record.");
      res.status(201).json({
        id: Math.floor(Math.random() * 1000) + 1000,
        followerId: numericFollower,
        followingId: numericFollowing,
        createdAt: new Date().toISOString()
      });
      return;
    }
    // Handle unique constraint violation (already following)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Already following this user." });
    }
    console.error("Error following user", error);
    res.status(500).json({ error: "Failed to follow user." });
  }
}

// DELETE /api/follow
async function unfollowUser(req, res) {
  // Check both req.body and req.query (for convenience)
  const followerId = req.body.followerId || req.query.followerId;
  const followingId = req.body.followingId || req.query.followingId;

  if (!followerId || !followingId) {
    return res.status(400).json({ error: "followerId and followingId are required." });
  }

  const numericFollower = Number(followerId);
  const numericFollowing = Number(followingId);

  try {
    await prisma.follow.deleteMany({
      where: {
        followerId: numericFollower,
        followingId: numericFollowing
      }
    });
    res.json({ message: "Unfollowed successfully." });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Simulating successful unfollow.");
      res.json({ message: "Unfollowed successfully." });
      return;
    }
    console.error("Error unfollowing user", error);
    res.status(500).json({ error: "Failed to unfollow user." });
  }
}

// GET /api/follow/:userId/followers
async function getFollowers(req, res) {
  const userId = Number(req.params.userId);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID." });
  }

  try {
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            department: true,
            college: true,
            reputationScore: true,
            bio: true,
            avatarUrl: true
          }
        }
      }
    });
    res.json(followers.map(f => ({
      id: f.follower.id,
      name: f.follower.name,
      department: f.follower.department,
      college: f.follower.college || 'SRM Institute of Science and Technology KTR',
      reputationScore: f.follower.reputationScore,
      avatar_url: f.follower.avatarUrl || null,
      bio: f.follower.bio || ''
    })));
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning empty array for followers.");
      res.json([]);
      return;
    }
    console.error("Error fetching followers", error);
    res.status(500).json({ error: "Failed to load followers." });
  }
}

// GET /api/follow/:userId/following
async function getFollowing(req, res) {
  const userId = Number(req.params.userId);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID." });
  }

  try {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            department: true,
            college: true,
            reputationScore: true,
            bio: true,
            avatarUrl: true
          }
        }
      }
    });
    res.json(following.map(f => ({
      id: f.following.id,
      name: f.following.name,
      department: f.following.department,
      college: f.following.college || 'SRM Institute of Science and Technology KTR',
      reputationScore: f.following.reputationScore,
      avatar_url: f.following.avatarUrl || null,
      bio: f.following.bio || ''
    })));
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning empty array for following.");
      res.json([]);
      return;
    }
    console.error("Error fetching following", error);
    res.status(500).json({ error: "Failed to load following." });
  }
}

// GET /api/follow/status
async function getFollowStatus(req, res) {
  const followerId = Number(req.query.followerId);
  const followingId = Number(req.query.followingId);

  if (isNaN(followerId) || isNaN(followingId)) {
    return res.status(400).json({ error: "followerId and followingId query parameters are required." });
  }

  try {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: followerId,
          followingId: followingId
        }
      }
    });
    res.json({ isFollowing: !!follow });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning isFollowing: false.");
      res.json({ isFollowing: false });
      return;
    }
    console.error("Error checking follow status", error);
    res.status(500).json({ error: "Failed to check follow status." });
  }
}

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus
};
