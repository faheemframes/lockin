const prisma = require("../config/db");
const memoryStore = require("../data/memoryStore");
const { isDbUnavailable } = require("../utils/dbFallback");

function required(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function createUser(req, res) {
  const { name, college, college_id, department, bio, instagram, github, interests, campusId, collegeId } = req.body;

  if (![name, college, college_id, department].every(required)) {
    return res.status(400).json({ error: "Name, college, college_id, and department are required." });
  }

  const payload = {
    name: name.trim(),
    college: college.trim(),
    college_id: college_id.trim(),
    department: department.trim(),
    bio: bio ? bio.trim() : "",
    instagram: instagram ? instagram.trim() : "",
    github: github ? github.trim() : "",
    interests: interests ? interests.trim() : "",
    campusId: campusId ? Number(campusId) : null,
    collegeId: collegeId ? Number(collegeId) : (campusId ? Number(campusId) : null)
  };

  let email = payload.college_id;
  if (!email.includes("@")) {
    email = `${email.toLowerCase().replace(/[^a-z0-9]/g, "")}@srmist.edu.in`;
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: email,
        department: payload.department,
        college: payload.college,
        reputationScore: 100, // Seed initial Aura to 100
        bio: payload.bio,
        instagram: payload.instagram,
        github: payload.github,
        interests: payload.interests,
        collegeId: payload.collegeId
      }
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      college: user.college,
      college_id: user.email,
      department: user.department,
      reputation_score: user.reputationScore,
      bio: user.bio,
      instagram: user.instagram,
      github: user.github,
      interests: user.interests,
      campus_id: user.collegeId,
      verified_at: user.verifiedAt
    });
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.status(201).json(memoryStore.createUser(payload));
  }
}

async function getUser(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      include: { collegeRef: true }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({
      id: user.id,
      name: user.name,
      college: user.college || 'SRM Institute of Science and Technology KTR',
      college_id: user.email,
      department: user.department,
      reputation_score: user.reputationScore,
      bio: user.bio || "",
      instagram: user.instagram || "",
      github: user.github || "",
      interests: user.interests || "",
      campus_id: user.collegeId,
      campus_name: user.collegeRef?.shortName || "",
      verified_at: user.verifiedAt,
      avatar_url: user.avatarUrl || null
    });
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    const user = memoryStore.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  }
}

async function getLockStatus(req, res) {
  try {
    const activeCount = await prisma.participation.count({
      where: {
        userId: Number(req.params.id),
        status: "Accepted",
        showedUp: null
      }
    });

    res.json({
      locked: activeCount >= 3,
      active_count: activeCount,
      max_active_missions: 3
    });
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json(memoryStore.getLockStatus(req.params.id));
  }
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { name, department, bio, instagram, github, interests, location, college, collegeId, campusId, avatarUrl } = req.body;

  const effectiveCollegeId = collegeId || campusId;

  try {
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        name: name ? name.trim() : undefined,
        department: department ? department.trim() : undefined,
        bio: bio !== undefined ? bio.trim() : undefined,
        instagram: instagram !== undefined ? instagram.trim() : undefined,
        github: github !== undefined ? github.trim() : undefined,
        interests: interests !== undefined ? interests.trim() : undefined,
        location: location !== undefined ? location.trim() : undefined,
        college: college !== undefined ? college.trim() : undefined,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
        collegeId: effectiveCollegeId !== undefined ? (effectiveCollegeId ? Number(effectiveCollegeId) : null) : undefined
      }
    });

    res.json({
      id: user.id,
      name: user.name,
      college: user.college,
      college_id: user.email,
      department: user.department,
      reputation_score: user.reputationScore,
      bio: user.bio,
      instagram: user.instagram,
      github: user.github,
      interests: user.interests,
      location: user.location,
      campus_id: user.collegeId,
      verified_at: user.verifiedAt,
      avatar_url: user.avatarUrl || null
    });
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json({ error: "Database unavailable." });
  }
}

async function getLeaderboard(req, res) {
  const { campusId, collegeId: cId } = req.query;
  const effectiveCollegeId = cId || campusId;
  if (!effectiveCollegeId) {
    return res.status(400).json({ error: "campusId or collegeId query parameter is required." });
  }

  try {
    const leaderboard = await prisma.user.findMany({
      where: { collegeId: Number(effectiveCollegeId) },
      orderBy: { reputationScore: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        department: true,
        reputationScore: true,
        interests: true
      }
    });

    const rows = leaderboard.map((u) => ({
      id: u.id,
      name: u.name,
      department: u.department,
      reputation_score: u.reputationScore,
      interests: u.interests
    }));

    res.json(rows);
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json([]);
  }
}

async function getUserHeat(req, res) {
  const userId = Number(req.params.id);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID." });
  }

  try {
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    oneYearAgo.setHours(0, 0, 0, 0);

    const activities = await prisma.dailyActivity.findMany({
      where: {
        userId,
        date: { gte: oneYearAgo }
      },
      orderBy: { date: "asc" }
    });

    res.json(activities);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning empty array for user heat map.");
      res.json([]);
      return;
    }
    console.error("Error fetching user activity heat", error);
    res.status(500).json({ error: "Failed to load heat map data." });
  }
}

async function getPublicProfile(req, res) {
  const userId = Number(req.params.id);
  const viewerId = req.query.viewerId ? Number(req.query.viewerId) : null;

  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        collegeRef: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // 1. Fetch Stats
    const recaps = await prisma.sessionRecap.findMany({
      where: { userId, recapType: "session" }
    });

    const totalMissions = recaps.length;
    const totalFocusMinutes = recaps.reduce((sum, r) => sum + r.sessionDuration, 0);
    const focusHours = Number((totalFocusMinutes / 60).toFixed(1));

    const totalJoined = await prisma.participation.count({ where: { userId } });
    const totalCompleted = await prisma.participation.count({ where: { userId, status: "Completed" } });
    const completionRate = totalJoined > 0 ? Math.round((totalCompleted / totalJoined) * 100) : 100;

    const latestRecap = await prisma.sessionRecap.findFirst({
      where: { userId, recapType: "session" },
      orderBy: { generatedAt: "desc" }
    });
    const currentStreak = latestRecap ? latestRecap.streak : 0;

    // Tasks completed (count tasks that are completed and belong to missions created by this user or where they participated)
    const tasksCompleted = await prisma.task.count({
      where: {
        mission: { createdBy: userId },
        completed: true
      }
    });

    // Active days count
    const activeDays = await prisma.dailyActivity.count({
      where: { userId }
    });

    // 2. Fetch Follow Counts
    const followersCount = await prisma.follow.count({ where: { followingId: userId } });
    const followingCount = await prisma.follow.count({ where: { followerId: userId } });

    // Check if viewer follows this user
    let isFollowing = false;
    if (viewerId) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: userId
          }
        }
      });
      isFollowing = !!follow;
    }

    // 3. Fetch Recent Feed Items (last 10)
    const feedItems = await prisma.feedItem.findMany({
      where: { userId },
      orderBy: { id: "desc" },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: true,
            college: true,
            reputationScore: true
          }
        }
      }
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        college: user.college,
        college_id: user.email,
        department: user.department,
        reputation_score: user.reputationScore,
        bio: user.bio,
        instagram: user.instagram,
        github: user.github,
        interests: user.interests,
        campus_id: user.collegeId,
        campus_name: user.collegeRef?.shortName || "",
        verified_at: user.verifiedAt,
        avatar_url: user.avatarUrl || null
      },
      stats: {
        totalMissions,
        focusHours,
        completionRate,
        currentStreak,
        tasksCompleted,
        activeDays
      },
      followersCount,
      followingCount,
      isFollowing,
      feedItems
    });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock public profile.");
      res.json({
        user: {
          id: userId,
          name: "Mock User",
          college: "SRM KTR",
          college_id: "mock@srmist.edu.in",
          department: "CSE",
          reputation_score: 150,
          bio: "Just locking in.",
          instagram: "",
          github: "",
          interests: "",
          campus_id: 1,
          campus_name: "KTR Campus"
        },
        stats: {
          totalMissions: 5,
          focusHours: 3.5,
          completionRate: 100,
          currentStreak: 3,
          tasksCompleted: 12,
          activeDays: 4
        },
        followersCount: 10,
        followingCount: 12,
        isFollowing: false,
        feedItems: []
      });
      return;
    }
    console.error("Error fetching public profile", error);
    res.status(500).json({ error: "Failed to load public profile." });
  }
}

async function searchUsers(req, res) {
  const q = req.query.q || '';
  const currentUserId = req.query.currentUserId ? Number(req.query.currentUserId) : null;

  if (q.trim().length < 2) {
    return res.json([]);
  }

  const cleanQuery = q.trim();

  try {
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: cleanQuery, mode: "insensitive" } },
              { department: { contains: cleanQuery, mode: "insensitive" } }
            ]
          },
          currentUserId ? { id: { not: currentUserId } } : {}
        ]
      },
      select: {
        id: true,
        name: true,
        department: true,
        college: true,
        reputationScore: true,
        avatarUrl: true
      },
      take: 20
    });

    res.json(users.map(u => ({
      id: u.id,
      name: u.name,
      department: u.department,
      college: u.college || 'SRM Institute of Science and Technology KTR',
      reputationScore: u.reputationScore,
      avatar_url: u.avatarUrl || null
    })));
  } catch (error) {
    if (isDbUnavailable(error)) {
      res.json([]);
      return;
    }
    console.error("Error searching users", error);
    res.status(500).json({ error: "Failed to search users." });
  }
}

module.exports = {
  createUser,
  getUser,
  getLockStatus,
  updateUser,
  getLeaderboard,
  getUserHeat,
  getPublicProfile,
  searchUsers
};
