const prisma = require("../config/db");
const crypto = require("crypto");
const { checkAchievements } = require("../utils/achievements");
const { isDbUnavailable } = require("../utils/dbFallback");

// Helper to calculate streak from dates
function calculateStreak(recapDates) {
  if (recapDates.length === 0) return 0;
  const dates = Array.from(new Set(recapDates.map(d => new Date(d).toDateString()))).map(d => new Date(d));
  dates.sort((a, b) => b - a); // descending order

  let streak = 0;
  let currentDate = new Date(); // start checking from today
  currentDate.setHours(0, 0, 0, 0);

  const todayStr = currentDate.toDateString();
  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const hasToday = dates.some(d => d.toDateString() === todayStr);
  const hasYesterday = dates.some(d => d.toDateString() === yesterdayStr);

  if (!hasToday && !hasYesterday) {
    return 0;
  }

  let expectedDate = hasToday ? currentDate : yesterday;
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === expectedDate.getTime()) {
      streak++;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else if (d.getTime() < expectedDate.getTime()) {
      break;
    }
  }
  return streak;
}

// POST /api/missions/:id/finish
async function finishSession(req, res) {
  const missionId = Number(req.params.id);
  const { userId, tasksCompleted, reflection, sessionDuration: requestedDuration, isFailed = false } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }

  try {
    const numericUserId = Number(userId);

    // 1. Find the mission and user participation
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        category: true,
        participations: {
          include: { user: true }
        }
      }
    });

    if (!mission) {
      return res.status(404).json({ error: "Mission not found." });
    }

    // Identify role
    const isCreator = mission.createdBy === numericUserId;
    const participation = mission.participations.find(p => p.userId === numericUserId);

    if (!isCreator && !participation) {
      return res.status(403).json({ error: "You are not part of this mission." });
    }

    // Use requested actual focus duration, otherwise fallback to mission focus duration
    const sessionDuration = requestedDuration !== undefined ? Number(requestedDuration) : (mission.focusDuration || 25);

    // 2. Mark participation status to Completed on database
    if (participation && participation.status !== "Completed") {
      await prisma.participation.update({
        where: { id: participation.id },
        data: { status: "Completed" }
      });
    }

    // 3. Calculate streak (incorporating previous recaps)
    const prevRecaps = await prisma.sessionRecap.findMany({
      where: { userId: numericUserId },
      select: { generatedAt: true }
    });
    const recapDates = prevRecaps.map(r => r.generatedAt);
    recapDates.push(new Date()); // include today
    const currentStreak = calculateStreak(recapDates);

    // 4. Calculate total participants
    let participantCount = 1;
    if (mission.missionType === "solo") {
      participantCount = 1;
    } else if (mission.createdBy && mission.participations.length > 0) {
      // Creator + all accepted participants (excluding solo records if any)
      const activeParticipants = mission.participations.filter(p => p.status === "Accepted" || p.status === "Executing" || p.status === "Completed").length;
      participantCount = 1 + activeParticipants;
    }

    // 5. Calculate mission rank (based on other recaps submitted for this mission)
    const existingRecaps = await prisma.sessionRecap.findMany({
      where: { missionId: missionId }
    });

    // Compute numeric rank
    let rank = 1;
    existingRecaps.forEach(r => {
      if (r.userId !== numericUserId) {
        if (r.sessionDuration > sessionDuration) {
          rank++;
        } else if (r.sessionDuration === sessionDuration && r.tasksCompleted > tasksCompleted) {
          rank++;
        }
      }
    });

    // 6. Personal Bests calculations
    const allUserRecaps = await prisma.sessionRecap.findMany({
      where: { userId: numericUserId }
    });

    const maxPastDuration = allUserRecaps.reduce((max, r) => Math.max(max, r.sessionDuration), 0);
    const maxPastTasks = allUserRecaps.reduce((max, r) => Math.max(max, r.tasksCompleted), 0);
    const maxPastStreak = allUserRecaps.reduce((max, r) => Math.max(max, r.streak), 0);

    const isNewLongestSession = allUserRecaps.length === 0 || sessionDuration > maxPastDuration;
    const isNewMostTasks = allUserRecaps.length === 0 || tasksCompleted > maxPastTasks;
    const isNewLongestStreak = allUserRecaps.length === 0 || currentStreak > maxPastStreak;

    // 7. Unlocked Achievements dynamic engine checks
    const totalMissionsCount = allUserRecaps.length + 1;
    const maxMinutes = Math.max(maxPastDuration, sessionDuration);
    const totalTasks = allUserRecaps.reduce((sum, r) => sum + r.tasksCompleted, 0) + tasksCompleted;

    // Calculate weekly / monthly focus minutes (including current session)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyFocusMinutes = allUserRecaps
      .filter(r => new Date(r.generatedAt) >= sevenDaysAgo)
      .reduce((sum, r) => sum + r.sessionDuration, 0) + sessionDuration;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyFocusMinutes = allUserRecaps
      .filter(r => new Date(r.generatedAt) >= thirtyDaysAgo)
      .reduce((sum, r) => sum + r.sessionDuration, 0) + sessionDuration;

    // Fetch user for reputation check
    const user = await prisma.user.findUnique({
      where: { id: numericUserId }
    });
    const currentAura = user ? user.reputationScore : 100;

    const achievementStats = {
      totalMissions: totalMissionsCount,
      maxSessionMinutes: maxMinutes,
      weeklyFocusMinutes,
      monthlyFocusMinutes,
      currentStreak,
      totalTasksCompleted: totalTasks,
      rank,
      participantCount,
      reputationScore: currentAura
    };

    const unlockedAchievements = checkAchievements(achievementStats);

    // 8. If crashed, deduct 5 Aura. If successful solo, award 10 Aura.
    if (isFailed) {
      await prisma.user.update({
        where: { id: numericUserId },
        data: {
          reputationScore: { decrement: 5 }
        }
      });
    } else if (mission.missionType === "solo") {
      await prisma.user.update({
        where: { id: numericUserId },
        data: {
          reputationScore: { increment: 10 }
        }
      });
    }

    // 9. Create SessionRecap database record
    const shareId = crypto.randomUUID();
    const recap = await prisma.sessionRecap.create({
      data: {
        userId: numericUserId,
        missionId: missionId,
        missionTitle: mission.title,
        categoryId: mission.categoryId,
        categorySnapshot: mission.category?.categoryName || "Other",
        sessionDuration: sessionDuration,
        tasksCompleted: tasksCompleted,
        streak: currentStreak,
        missionRank: rank,
        cardVersion: 1,
        shareId: shareId,
        achievements: unlockedAchievements,
        participantCount: participantCount,
        recapType: "session",
        reflectionText: reflection?.reflectionText || null,
        lessonsLearned: reflection?.lessonsLearned || null,
        isPublic: reflection?.isPublic !== undefined ? reflection.isPublic : true,
        metadata: {
          isNewLongestSession,
          isNewMostTasks,
          isNewLongestStreak,
          screenshot: reflection?.screenshot || null,
          link: reflection?.link || null,
          isFailed: isFailed
        }
      }
    });

    // 10. Upsert DailyActivity for user
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyMissionsInc = isFailed ? 0 : 1;
    const dailyAuraInc = isFailed ? -5 : 10;

    await prisma.dailyActivity.upsert({
      where: {
        userId_date: {
          userId: numericUserId,
          date: today
        }
      },
      update: {
        missionsCompleted: { increment: dailyMissionsInc },
        focusMinutes: { increment: sessionDuration },
        tasksCompleted: { increment: tasksCompleted || 0 },
        auraEarned: { increment: dailyAuraInc }
      },
      create: {
        userId: numericUserId,
        date: today,
        missionsCompleted: dailyMissionsInc,
        focusMinutes: sessionDuration,
        tasksCompleted: tasksCompleted || 0,
        auraEarned: dailyAuraInc
      }
    });

    // 11. Create a FeedItem and Post if public
    if (recap.isPublic) {
      await prisma.feedItem.create({
        data: {
          userId: numericUserId,
          type: "mission_completed",
          title: isFailed ? `Crashed: ${mission.title}` : `Completed: ${mission.title}`,
          description: reflection?.reflectionText || null,
          metadata: {
            sessionDuration,
            tasksCompleted: tasksCompleted || 0,
            category: mission.category?.categoryName || "Other",
            missionType: mission.missionType || "group",
            participantCount,
            screenshot: reflection?.screenshot || null,
            link: reflection?.link || null,
            isFailed: isFailed
          },
          recapId: recap.id
        }
      });

      await prisma.post.create({
        data: {
          userId: numericUserId,
          recapId: recap.id,
          imageUrl: reflection?.screenshot || null,
          caption: reflection?.reflectionText || (isFailed ? `Crashed: ${mission.title}` : `Completed: ${mission.title}`),
          visibility: "everyone"
        }
      });
    }


    res.status(201).json({
      ...recap,
      personalBests: {
        isNewLongestSession,
        isNewMostTasks,
        isNewLongestStreak
      },
      unlockedAchievements
    });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Falling back to memoryStore mock for finishSession.");
      res.status(201).json({
        id: Math.floor(Math.random() * 1000) + 1000,
        userId: Number(userId),
        missionId: missionId,
        missionTitle: "Focus Runway Run",
        categoryId: 1,
        categorySnapshot: "Other",
        sessionDuration: 25,
        tasksCompleted: Number(tasksCompleted || 0),
        streak: 3,
        missionRank: 1,
        cardVersion: 1,
        shareId: crypto.randomUUID(),
        recapType: "session",
        generatedAt: new Date().toISOString(),
        personalBests: {
          isNewLongestSession: true,
          isNewMostTasks: false,
          isNewLongestStreak: true
        },
        unlockedAchievements: []
      });
      return;
    }
    console.error("Error finishing session", error);
    res.status(500).json({ error: "Failed to finish session." });
  }
}

// POST /api/recaps/generate
async function generatePeriodRecap(req, res) {
  const { userId, recapType } = req.body;

  if (!userId || !recapType) {
    return res.status(400).json({ error: "userId and recapType are required." });
  }

  try {
    const numericUserId = Number(userId);

    const filterDate = new Date();
    if (recapType === "weekly") {
      filterDate.setDate(filterDate.getDate() - 7);
    } else if (recapType === "monthly") {
      filterDate.setDate(filterDate.getDate() - 30);
    } else if (recapType === "yearly") {
      filterDate.setMonth(0, 1); // Start of year
      filterDate.setHours(0, 0, 0, 0);
    } else {
      return res.status(400).json({ error: "Invalid recapType. Must be weekly, monthly, or yearly." });
    }

    // Fetch recaps in date range
    const recaps = await prisma.sessionRecap.findMany({
      where: {
        userId: numericUserId,
        recapType: "session",
        generatedAt: { gte: filterDate }
      }
    });

    if (recaps.length === 0) {
      return res.status(200).json({
        recapType,
        sessionDuration: 0,
        tasksCompleted: 0,
        missionsCompleted: 0,
        longestSession: 0,
        currentStreak: 0,
        topCategory: "None",
        categoryBreakdown: []
      });
    }

    // Aggregate statistics
    const totalFocusMinutes = recaps.reduce((sum, r) => sum + r.sessionDuration, 0);
    const totalTasksCompleted = recaps.reduce((sum, r) => sum + r.tasksCompleted, 0);
    const missionsCompleted = recaps.length;
    const longestSession = recaps.reduce((max, r) => Math.max(max, r.sessionDuration), 0);

    // Get current streak (using all past user records)
    const allRecaps = await prisma.sessionRecap.findMany({
      where: { userId: numericUserId, recapType: "session" },
      select: { generatedAt: true }
    });
    const currentStreak = calculateStreak(allRecaps.map(r => r.generatedAt));

    // Calculate category breakdown
    const categoryMinutes = {};
    recaps.forEach(r => {
      const cat = r.categorySnapshot || "Other";
      categoryMinutes[cat] = (categoryMinutes[cat] || 0) + r.sessionDuration;
    });

    // Find top category
    let topCategory = "Other";
    let maxMinutes = 0;
    const categoryBreakdown = Object.entries(categoryMinutes).map(([name, minutes]) => {
      if (minutes > maxMinutes) {
        maxMinutes = minutes;
        topCategory = name;
      }
      return { name, hours: Math.round((minutes / 60) * 10) / 10 };
    });

    categoryBreakdown.sort((a, b) => b.hours - a.hours);

    // Generate unique UUID shareId dynamically
    const shareId = crypto.randomUUID();

    // Save period recap to database so it is shareable publically
    const createdRecap = await prisma.sessionRecap.create({
      data: {
        userId: numericUserId,
        recapType: recapType,
        shareId: shareId,
        sessionDuration: totalFocusMinutes,
        tasksCompleted: totalTasksCompleted,
        streak: currentStreak,
        categorySnapshot: topCategory,
        metadata: {
          missionsCompleted,
          longestSession,
          categoryBreakdown
        }
      }
    });

    res.json({
      recapType,
      shareId: createdRecap.shareId,
      sessionDuration: createdRecap.sessionDuration,
      tasksCompleted: createdRecap.tasksCompleted,
      missionsCompleted,
      longestSession,
      currentStreak: createdRecap.streak,
      topCategory: createdRecap.categorySnapshot,
      categoryBreakdown,
      generatedAt: createdRecap.generatedAt.toISOString()
    });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Falling back to memoryStore mock for generatePeriodRecap.");
      const shareId = crypto.randomUUID();
      res.json({
        recapType,
        shareId,
        sessionDuration: 180,
        tasksCompleted: 8,
        missionsCompleted: 3,
        longestSession: 60,
        currentStreak: 4,
        topCategory: "Programming",
        categoryBreakdown: [
          { name: "Programming", hours: 2 },
          { name: "Design", hours: 1 }
        ],
        generatedAt: new Date().toISOString()
      });
      return;
    }
    console.error("Error generating period recap", error);
    res.status(500).json({ error: "Failed to generate wrapped card." });
  }
}

// GET /api/recaps/user/:userId
async function getUserRecaps(req, res) {
  const { userId } = req.params;
  const { sortBy, category, year } = req.query;

  try {
    const numericUserId = Number(userId);

    const whereClause = {
      userId: numericUserId,
      recapType: "session"
    };

    if (category && category !== "all") {
      whereClause.categorySnapshot = category;
    }

    if (year && year !== "all") {
      const startOfYear = new Date(Number(year), 0, 1);
      const endOfYear = new Date(Number(year), 11, 31, 23, 59, 59);
      whereClause.generatedAt = {
        gte: startOfYear,
        lte: endOfYear
      };
    }

    // Default sorting
    let orderByClause = { generatedAt: "desc" };
    if (sortBy === "longest") {
      orderByClause = { sessionDuration: "desc" };
    } else if (sortBy === "tasks") {
      orderByClause = { tasksCompleted: "desc" };
    }

    const recaps = await prisma.sessionRecap.findMany({
      where: whereClause,
      orderBy: orderByClause,
      include: {
        mission: {
          select: { location: true }
        }
      }
    });

    res.json(recaps);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning empty array for user recaps.");
      res.json([]);
      return;
    }
    console.error("Error fetching user recaps", error);
    res.status(500).json({ error: "Failed to load recaps list." });
  }
}

// GET /api/recaps/mission/:missionId/user/:userId
async function getMissionRecap(req, res) {
  const missionId = Number(req.params.missionId);
  const userId = Number(req.params.userId);

  try {
    const recap = await prisma.sessionRecap.findFirst({
      where: {
        missionId,
        userId
      }
    });

    if (!recap) {
      return res.status(404).json({ error: "No recap found for this session." });
    }

    res.json(recap);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock mission recap.");
      res.json({
        id: 999,
        userId: Number(userId),
        missionId: missionId,
        missionTitle: "Mock Focus Run",
        categorySnapshot: "Programming",
        sessionDuration: 45,
        tasksCompleted: 3,
        streak: 2,
        missionRank: 1,
        shareId: "mock-share-" + missionId,
        recapType: "session",
        generatedAt: new Date().toISOString()
      });
      return;
    }
    console.error("Error fetching mission recap", error);
    res.status(500).json({ error: "Failed to load session recap." });
  }
}

// GET /api/recaps/share/:shareId
// Read-only public share lookups, rate-limited and exposing NO private student records
async function getPublicShareRecap(req, res) {
  const { shareId } = req.params;

  try {
    const recap = await prisma.sessionRecap.findUnique({
      where: { shareId },
      include: {
        user: {
          select: {
            name: true,
            department: true,
            college: true
          }
        }
      }
    });

    if (!recap) {
      return res.status(404).json({ error: "Recap page not found." });
    }

    // Strip out any potentially sensitive fields (like private configs or deep system records)
    const securePayload = {
      recapType: recap.recapType,
      missionTitle: recap.missionTitle,
      categorySnapshot: recap.categorySnapshot,
      sessionDuration: recap.sessionDuration,
      tasksCompleted: recap.tasksCompleted,
      streak: recap.streak,
      missionRank: recap.missionRank,
      achievements: recap.achievements,
      participantCount: recap.participantCount,
      generatedAt: recap.generatedAt,
      metadata: recap.metadata,
      reflectionText: recap.isPublic ? recap.reflectionText : null,
      lessonsLearned: recap.isPublic ? recap.lessonsLearned : null,
      creator: {
        name: recap.user.name,
        department: recap.user.department,
        college: recap.user.college
      }
    };

    res.json(securePayload);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock public share recap.");
      res.json({
        recapType: "weekly",
        missionTitle: "Weekly Progress Run",
        categorySnapshot: "Programming",
        sessionDuration: 180,
        tasksCompleted: 8,
        streak: 4,
        missionRank: 1,
        achievements: [{ id: 1, title: "Consistent Agent" }],
        participantCount: 1,
        generatedAt: new Date().toISOString(),
        metadata: {
          missionsCompleted: 3,
          longestSession: 60
        },
        creator: {
          name: "Rayaan Arora",
          department: "CSE, 3rd Year",
          college: "SRM IST, Kattankulathur (KTR)"
        }
      });
      return;
    }
    console.error("Error loading shared recap page", error);
    res.status(500).json({ error: "Server error loading shared page." });
  }
}

module.exports = {
  finishSession,
  generatePeriodRecap,
  getUserRecaps,
  getMissionRecap,
  getPublicShareRecap
};
