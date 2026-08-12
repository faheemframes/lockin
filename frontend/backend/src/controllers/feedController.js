const prisma = require("../config/db");
const { isDbUnavailable } = require("../utils/dbFallback");

// GET /api/feed
async function getFeed(req, res) {
  const userId = Number(req.query.userId);
  const filter = req.query.filter || "all"; // "all" | "following" | "campus"
  const limit = Number(req.query.limit) || 20;
  const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;

  if (isNaN(userId)) {
    return res.status(400).json({ error: "userId query parameter is required and must be a number." });
  }

  try {
    const whereClause = {};

    if (filter === "following") {
      // Find who the user is following
      const follows = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true }
      });
      const followingIds = follows.map(f => f.followingId);
      // Include following users + current user themselves
      whereClause.userId = { in: [...followingIds, userId] };
    } else if (filter === "campus") {
      // Find current user's college
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { collegeId: true }
      });
      if (user && user.collegeId) {
        whereClause.user = { collegeId: user.collegeId };
      } else {
        // If user has no college, campus feed is just empty or fallback to user's own
        whereClause.userId = userId;
      }
    }

    const queryOptions = {
      take: limit,
      where: whereClause,
      orderBy: { id: "desc" },
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
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;
    }

    const feedItems = await prisma.feedItem.findMany(queryOptions);

    // Get next cursor
    const nextCursor = feedItems.length === limit ? feedItems[feedItems.length - 1].id : null;

    res.json({
      feedItems,
      nextCursor
    });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock feed items.");
      res.json({
        feedItems: [
          {
            id: 1,
            userId,
            type: "mission_completed",
            title: "Completed: Gym Session",
            description: "Crushed leg day today. High intensity.",
            metadata: {
              sessionDuration: 45,
              tasksCompleted: 4,
              category: "Fitness",
              missionType: "solo",
              participantCount: 1
            },
            recapId: 999,
            createdAt: new Date().toISOString(),
            user: {
              id: userId,
              name: "Rayaan Arora",
              department: "CSE",
              college: "SRM KTR",
              reputationScore: 240
            }
          }
        ],
        nextCursor: null
      });
      return;
    }
    console.error("Error fetching activity feed", error);
    res.status(500).json({ error: "Failed to load activity feed." });
  }
}

// GET /api/feed/user/:userId
async function getUserFeed(req, res) {
  const userId = Number(req.params.userId);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID." });
  }

  try {
    const feedItems = await prisma.feedItem.findMany({
      where: { userId },
      orderBy: { id: "desc" },
      take: 15,
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

    res.json(feedItems);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning empty user feed.");
      res.json([]);
      return;
    }
    console.error("Error fetching user feed items", error);
    res.status(500).json({ error: "Failed to load user feed." });
  }
}

// GET /api/feed/live
async function getLiveActivities(req, res) {
  try {
    const activeParticipations = await prisma.participation.findMany({
      where: {
        status: "Executing",
        workStartedAt: { not: null }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: true
          }
        },
        mission: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                department: true
              }
            }
          }
        }
      }
    });

    const liveItems = [];
    const processedUserIds = new Set();
    const now = Date.now();

    activeParticipations.forEach((p) => {
      if (!p.mission) return;

      const workStartedAt = p.workStartedAt;
      const targetDuration = p.mission.focusDuration || 25;
      
      const elapsedMs = now - new Date(workStartedAt).getTime();
      const maxAgeMs = (targetDuration + 30) * 60000;
      if (elapsedMs > maxAgeMs) {
        return; // skip stale runs
      }

      // 1. Participant focusing
      if (p.user && !processedUserIds.has(p.user.id)) {
        liveItems.push({
          userId: p.user.id,
          name: p.user.name,
          department: p.user.department || "Student",
          missionId: p.mission.id,
          missionTitle: p.mission.title,
          workStartedAt: workStartedAt.toISOString(),
          targetDuration,
          role: p.mission.missionType === "solo" ? "solo" : "participant"
        });
        processedUserIds.add(p.user.id);
      }

      // 2. Creator focusing (for group runs)
      if (p.mission.missionType === "group" && p.mission.creator) {
        if (!processedUserIds.has(p.mission.creator.id)) {
          liveItems.push({
            userId: p.mission.creator.id,
            name: p.mission.creator.name,
            department: p.mission.creator.department || "Student",
            missionId: p.mission.id,
            missionTitle: p.mission.title,
            workStartedAt: workStartedAt.toISOString(),
            targetDuration,
            role: "creator"
          });
          processedUserIds.add(p.mission.creator.id);
        }
      }
    });

    res.json(liveItems);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock live activities.");
      res.json([
        {
          userId: 102,
          name: "Faheem",
          department: "CSE",
          missionId: 999,
          missionTitle: "Building LOCKIN V2",
          workStartedAt: new Date(Date.now() - 12 * 60000).toISOString(),
          targetDuration: 25,
          role: "creator"
        }
      ]);
      return;
    }
    console.error("Error fetching live activities", error);
    res.status(500).json({ error: "Failed to load live activities." });
  }
}

module.exports = {
  getFeed,
  getUserFeed,
  getLiveActivities
};
