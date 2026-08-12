const prisma = require("../config/db");
const memoryStore = require("../data/memoryStore");
const { isDbUnavailable } = require("../utils/dbFallback");

function assertUserId(userId, res) {
  if (!userId) {
    res.status(400).json({ error: "userId is required." });
    return false;
  }
  return true;
}

async function createMission(req, res) {
  const { creator_id, title, description, location, datetime, categoryId, focusDuration, missionType, coverColor, coverImage } = req.body;
  const isSolo = missionType === "solo";

  if (!creator_id || !title || !description || (!isSolo && (!location || !datetime))) {
    return res.status(400).json({ error: "creator_id, title, description, location, and datetime are required." });
  }

  const payload = {
    creator_id: Number(creator_id),
    title: title.trim(),
    description: description.trim(),
    location: location ? location.trim() : "Solo",
    datetime: datetime ? new Date(datetime) : null,
    categoryId: categoryId ? Number(categoryId) : 1,
    focusDuration: focusDuration ? Number(focusDuration) : 25,
    missionType: isSolo ? "solo" : "group"
  };

  try {
    const creatorUser = await prisma.user.findUnique({
      where: { id: payload.creator_id },
      select: { collegeId: true }
    });

    if (!creatorUser) {
      return res.status(400).json({ error: "User session is invalid. Please log out and sign in again." });
    }

    const verificationCode = String(Math.floor(1000 + Math.random() * 9000));
    const mission = await prisma.mission.create({
      data: {
        title: payload.title,
        description: payload.description,
        datetime: payload.datetime,
        location: payload.location,
        categoryId: payload.categoryId,
        createdBy: payload.creator_id,
        collegeId: creatorUser ? creatorUser.collegeId : null,
        focusDuration: payload.focusDuration,
        verificationCode: verificationCode,
        missionType: payload.missionType,
        coverColor: coverColor || null,
        coverImage: coverImage || null
      },
      include: {
        creator: {
          select: { name: true, department: true }
        }
      }
    });

    if (payload.missionType === "solo") {
      // Auto-create participation as Accepted for solo missions
      await prisma.participation.create({
        data: {
          userId: payload.creator_id,
          missionId: mission.id,
          status: "Accepted"
        }
      });
    }

    res.status(201).json({
      id: mission.id,
      creator_id: mission.createdBy,
      title: mission.title,
      description: mission.description,
      location: mission.location,
      datetime: mission.datetime ? mission.datetime.toISOString() : null,
      creator_name: mission.creator?.name || "Unknown",
      creator_department: mission.creator?.department || "Creator",
      verification_code: mission.verificationCode,
      focus_duration: mission.focusDuration,
      mission_type: mission.missionType,
      cover_color: mission.coverColor,
      cover_image: mission.coverImage
    });
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.status(201).json(memoryStore.createMission(payload));
  }
}

async function getMissionFeed(req, res) {
  const { userId, categoryId } = req.query;
  if (!assertUserId(userId, res)) return;

  try {
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

    const numericUserId = Number(userId);

    const activeUser = await prisma.user.findUnique({
      where: { id: numericUserId },
      select: { collegeId: true }
    });

    const whereClause = {
      createdBy: { not: numericUserId },
      datetime: { gte: twelveHoursAgo },
      collegeId: activeUser ? activeUser.collegeId : null,
      missionType: { not: "solo" }, // Exclude solo missions from feed
      participations: {
        none: {
          userId: numericUserId
        }
      }
    };

    if (categoryId && categoryId !== "all") {
      whereClause.categoryId = Number(categoryId);
    }

    const missions = await prisma.mission.findMany({
      where: whereClause,
      orderBy: { datetime: "asc" },
      include: {
        category: true,
        creator: true,
        participations: {
          where: {
            status: { in: ["Accepted", "Executing", "Completed"] }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                department: true,
                reputationScore: true
              }
            }
          }
        }
      }
    });

    const rows = missions.map((m) => {
      const attendees = [];
      if (m.creator) {
        attendees.push({
          id: m.createdBy,
          name: m.creator.name,
          department: m.creator.department || "Host",
          reputation_score: m.creator.reputationScore || 0,
          is_host: true
        });
      }

      const acceptedParticipants = (m.participations || [])
        .map((p) => {
          if (!p.user || p.user.id === m.createdBy) return null;
          return {
            id: p.user.id,
            name: p.user.name,
            department: p.user.department || "Student",
            reputation_score: p.user.reputationScore || 0,
            is_host: false
          };
        })
        .filter(Boolean);

      attendees.push(...acceptedParticipants);

      return {
        id: m.id,
        creator_id: m.createdBy,
        title: m.title,
        description: m.description || `Category: ${m.category?.categoryName || "Coding"}. Meet at ${m.location} and execute the mission.`,
        location: m.location,
        datetime: m.datetime ? m.datetime.toISOString() : null,
        creator_name: m.creator?.name || "Unknown",
        creator_department: m.creator?.department || "Creator",
        category_name: m.category?.categoryName || "Coding",
        category_id: m.categoryId,
        category_emoji: m.category?.emoji || "💻",
        category_color: m.category?.colorHex || "#3b82f6",
        focus_duration: m.focusDuration,
        mission_type: m.missionType,
        cover_color: m.coverColor,
        cover_image: m.coverImage,
        locked_in_count: attendees.length,
        attendees: attendees
      };
    });

    res.json(rows);
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json(memoryStore.getMissionFeed(userId, categoryId));
  }
}

async function acceptMission(req, res) {
  const { id } = req.params;
  const { userId } = req.body;
  if (!assertUserId(userId, res)) return;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const userExists = await tx.user.findUnique({
        where: { id: Number(userId) },
        select: { id: true }
      });

      if (!userExists) {
        throw new Error("USER_NOT_FOUND");
      }

      const activeCount = await tx.participation.count({
        where: {
          userId: Number(userId),
          status: "Accepted",
          showedUp: null
        }
      });

      if (activeCount >= 3) {
        throw new Error("LOCKED_OUT");
      }

      const mission = await tx.mission.findUnique({
        where: { id: Number(id) }
      });

      if (!mission) {
        throw new Error("NOT_FOUND");
      }

      const existing = await tx.participation.findUnique({
        where: {
          unique_user_mission: {
            userId: Number(userId),
            missionId: Number(id)
          }
        }
      });

      // Already locked in / requested — do not create duplicates or re-notify
      if (
        existing &&
        ["Requested", "Accepted", "Executing", "Completed"].includes(existing.status)
      ) {
        return { participation: existing, isNew: false };
      }

      const participation = await tx.participation.upsert({
        where: {
          unique_user_mission: {
            userId: Number(userId),
            missionId: Number(id)
          }
        },
        update: { status: "Requested" },
        create: {
          userId: Number(userId),
          missionId: Number(id),
          status: "Requested"
        }
      });

      return { participation, isNew: true };
    });

    // Real-time Push Notification to Host (only on first request)
    if (result.isNew) {
      try {
        const mission = await prisma.mission.findUnique({
          where: { id: Number(id) },
          select: { createdBy: true, title: true }
        });
        const applicant = await prisma.user.findUnique({
          where: { id: Number(userId) },
          select: { name: true }
        });
        if (mission && mission.createdBy) {
          const supabaseClient = require("../config/supabase");
          if (supabaseClient) {
            const channel = supabaseClient.channel(`notifications:${mission.createdBy}`);
            channel.subscribe((status) => {
              if (status === "SUBSCRIBED") {
                channel.send({
                  type: "broadcast",
                  event: "push_notification",
                  payload: {
                    title: "New Join Request!",
                    message: `${applicant?.name || "Someone"} requested to join your runway: "${mission.title}"`,
                    type: "join_request",
                    missionId: Number(id)
                  }
                }).catch(err => console.error("Realtime notification broadcast failed:", err));
              }
            });
          }
        }
      } catch (err) {
        console.error("Error sending join request notification:", err);
      }
    }

    res.status(result.isNew ? 201 : 200).json({
      mission_id: result.participation.missionId,
      user_id: result.participation.userId,
      status: result.participation.status,
      already_locked: !result.isNew
    });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(400).json({ error: "User session is invalid. Please log out and sign in again." });
    }
    if (error.message === "LOCKED_OUT") {
      return res.status(423).json({ error: "Runway full. Mark attendance on your active missions before accepting more." });
    }
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Mission not found." });
    }
    if (isDbUnavailable(error)) {
      const result = memoryStore.acceptMission(id, userId);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.status(201).json(result);
    }
    throw error;
  }
}

async function passMission(req, res) {
  res.json({ mission_id: Number(req.params.id), passed: true });
}

async function getActiveMissions(req, res) {
  const { userId } = req.params;
  const numericUserId = Number(userId);
  try {
    // 1. Fetch missions accepted by this user (exclude solo to prevent duplicates)
    const accepted = await prisma.participation.findMany({
      where: {
        userId: numericUserId,
        mission: {
          missionType: { not: "solo" }
        }
      },
      include: {
        user: { select: { name: true } },
        mission: {
          include: {
            category: true,
            creator: true,
            participations: {
              where: {
                status: { in: ["Accepted", "Executing", "Completed"] }
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    department: true,
                    reputationScore: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // 2. Fetch participations on missions hosted/created by this user (including solo)
    const hosted = await prisma.participation.findMany({
      where: {
        mission: {
          createdBy: numericUserId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: true,
            reputationScore: true
          }
        },
        mission: {
          include: {
            category: true,
            creator: true,
            participations: {
              where: {
                status: { in: ["Accepted", "Executing", "Completed"] }
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    department: true,
                    reputationScore: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // 3. Fetch all group missions created by this user to catch those with 0 active/pending participations
    const createdMissions = await prisma.mission.findMany({
      where: {
        createdBy: numericUserId,
        missionType: "group"
      },
      include: {
        category: true,
        creator: true,
        participations: {
          where: {
            status: { in: ["Accepted", "Executing", "Completed", "Requested"] }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                department: true,
                reputationScore: true
              }
            }
          }
        }
      }
    });

    const buildAttendees = (m) => {
      if (!m) return [];
      const attendees = [];
      if (m.creator) {
        attendees.push({
          id: m.createdBy,
          name: m.creator.name,
          department: m.creator.department || "Host",
          reputation_score: m.creator.reputationScore || 0,
          is_host: true
        });
      }
      const acceptedParticipants = (m.participations || [])
        .filter(p => ["Accepted", "Executing", "Completed"].includes(p.status))
        .map((p) => {
          if (!p.user || p.user.id === m.createdBy) return null;
          return {
            id: p.user.id,
            name: p.user.name,
            department: p.user.department || "Student",
            reputation_score: p.user.reputationScore || 0,
            is_host: false
          };
        })
        .filter(Boolean);
      attendees.push(...acceptedParticipants);
      return attendees;
    };

    const acceptedRows = accepted
      .filter((p) => p.status !== "Rejected")
      .map((p) => {
        if (!p.mission) return null;
        const attendees = buildAttendees(p.mission);
        return {
          id: p.mission.id,
          creator_id: p.mission.createdBy,
          title: p.mission.title,
          description: p.mission.description || `Category: ${p.mission.category?.categoryName || "Coding"}. Meet at ${p.mission.location} and execute the mission.`,
          location: p.mission.location,
          datetime: p.mission.datetime ? p.mission.datetime.toISOString() : null,
          status: p.status,
          showed_up: p.showedUp,
          creator_name: p.mission.creator?.name || "Unknown",
          role: "participant",
          participant_name: p.user?.name || "Me",
          focus_duration: p.mission.focusDuration,
          work_started_at: p.workStartedAt ? p.workStartedAt.toISOString() : null,
          work_duration: p.workDuration,
          creator_vibe_rating: p.creatorVibeRating,
          participant_vibe_rating: p.participantVibeRating,
          mission_type: p.mission.missionType,
          cover_color: p.mission.coverColor,
          cover_image: p.mission.coverImage,
          locked_in_count: attendees.length,
          attendees: attendees
        };
      })
      .filter(Boolean);

    const hostedRows = hosted
      .filter((p) => p.status !== "Rejected")
      .map((p) => {
        if (!p.mission) return null;
        const isSolo = p.mission.missionType === "solo";
        const attendees = buildAttendees(p.mission);
        return {
          id: p.mission.id,
          creator_id: p.mission.createdBy,
          title: p.mission.title,
          description: p.mission.description || `Category: ${p.mission.category?.categoryName || "Coding"}. Meet at ${p.mission.location} and execute the mission.`,
          location: p.mission.location,
          datetime: p.mission.datetime ? p.mission.datetime.toISOString() : null,
          status: p.status,
          showed_up: p.showedUp,
          creator_name: p.mission.creator?.name || "Me",
          role: isSolo ? "solo" : "creator",
          participant_name: isSolo ? "Me" : (p.user?.name || "Unknown"),
          participant_id: isSolo ? p.userId : p.userId,
          participant_department: isSolo ? (p.mission.creator?.department || "Student") : (p.user?.department || "Student"),
          participant_reputation: isSolo ? (p.mission.creator?.reputationScore || 0) : (p.user?.reputationScore || 0),
          verification_code: p.mission.verificationCode,
          focus_duration: p.mission.focusDuration,
          work_started_at: p.workStartedAt ? p.workStartedAt.toISOString() : null,
          work_duration: p.workDuration,
          creator_vibe_rating: p.creatorVibeRating,
          participant_vibe_rating: p.participantVibeRating,
          mission_type: p.mission.missionType,
          cover_color: p.mission.coverColor,
          cover_image: p.mission.coverImage,
          locked_in_count: attendees.length,
          attendees: attendees
        };
      })
      .filter(Boolean);

    const pendingRows = createdMissions
      .filter((m) => {
        // Only include if there is NO participation with status: Accepted, Executing, Completed, Missed, Requested
        const hasActiveOrPending = m.participations.some((p) =>
          ["Accepted", "Executing", "Completed", "Missed", "Requested"].includes(p.status)
        );
        return !hasActiveOrPending;
      })
      .map((m) => {
        const attendees = buildAttendees(m);
        return {
          id: m.id,
          creator_id: m.createdBy,
          title: m.title,
          description: m.description || `Category: ${m.category?.categoryName || "Coding"}. Meet at ${m.location} and execute the mission.`,
          location: m.location,
          datetime: m.datetime ? m.datetime.toISOString() : null,
          status: "Pending",
          showed_up: null,
          creator_name: m.creator?.name || "Me",
          role: "creator",
          participant_name: "Waiting for requests...",
          participant_id: null,
          participant_department: "",
          participant_reputation: 0,
          verification_code: m.verificationCode,
          focus_duration: m.focusDuration,
          work_started_at: null,
          work_duration: null,
          creator_vibe_rating: null,
          participant_vibe_rating: null,
          mission_type: m.missionType,
          cover_color: m.coverColor,
          cover_image: m.coverImage,
          locked_in_count: attendees.length,
          attendees: attendees
        };
      });

    const rows = [...acceptedRows, ...hostedRows, ...pendingRows];

    // Sort: showed_up = null first, then datetime
    rows.sort((a, b) => {
      if (a.showed_up === null && b.showed_up !== null) return -1;
      if (a.showed_up !== null && b.showed_up === null) return 1;
      if (!a.datetime && b.datetime) return 1;
      if (a.datetime && !b.datetime) return -1;
      if (!a.datetime && !b.datetime) return 0;
      return new Date(a.datetime) - new Date(b.datetime);
    });

    res.json(rows);
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json(memoryStore.getActiveMissions(userId));
  }
}

async function submitAttendance(req, res) {
  const { id } = req.params;
  const { userId, showedUp, code } = req.body;
  if (!assertUserId(userId, res)) return;
  if (typeof showedUp !== "boolean") {
    return res.status(400).json({ error: "showedUp must be true or false." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const participant = await tx.participation.findFirst({
        where: {
          missionId: Number(id),
          userId: Number(userId)
        },
        include: {
          mission: true
        }
      });

      if (!participant) {
        throw new Error("NOT_FOUND");
      }

      if (participant.status === "Executing" || participant.showedUp !== null) {
        throw new Error("ALREADY_SUBMITTED");
      }

      if (showedUp) {
        if (participant.mission.missionType !== "solo") {
          if (!code || String(code).trim() !== String(participant.mission.verificationCode).trim()) {
            throw new Error("INVALID_CODE");
          }
        }

        const updated = await tx.participation.update({
          where: { id: participant.id },
          data: {
            status: "Executing",
            workStartedAt: new Date(),
            workDuration: participant.mission.focusDuration,
            showedUp: true
          }
        });

        return {
          status: "Executing",
          workStartedAt: updated.workStartedAt
        };
      } else {
        // Creator marking participant as missed
        await tx.participation.update({
          where: { id: participant.id },
          data: {
            status: "Missed",
            showedUp: false
          }
        });

        // Deduct Aura immediately
        const updatedUser = await tx.user.update({
          where: { id: Number(userId) },
          data: {
            reputationScore: {
              decrement: 5
            }
          }
        });

        return {
          status: "Missed",
          reputationScore: updatedUser.reputationScore
        };
      }
    });

    res.json({
      mission_id: Number(id),
      user_id: Number(userId),
      status: result.status,
      work_started_at: result.workStartedAt ? result.workStartedAt.toISOString() : null
    });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Accepted mission not found." });
    }
    if (error.message === "ALREADY_SUBMITTED") {
      return res.status(409).json({ error: "Vibe check session already completed." });
    }
    if (error.message === "INVALID_CODE") {
      return res.status(400).json({ error: "Invalid check-in code. Please try again." });
    }
    if (isDbUnavailable(error)) {
      const result = memoryStore.submitAttendance(id, userId, showedUp, code);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    }
    throw error;
  }
}

async function approveParticipant(req, res) {
  const { id } = req.params;
  const { creatorId, participantId } = req.body;

  if (!creatorId || !participantId) {
    return res.status(400).json({ error: "creatorId and participantId are required." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const mission = await tx.mission.findUnique({
        where: { id: Number(id) }
      });

      if (!mission) {
        throw new Error("MISSION_NOT_FOUND");
      }

      if (mission.createdBy !== Number(creatorId)) {
        throw new Error("UNAUTHORIZED");
      }

      const targetParticipation = await tx.participation.findFirst({
        where: {
          missionId: Number(id),
          userId: Number(participantId),
          status: "Requested"
        }
      });

      if (!targetParticipation) {
        throw new Error("REQUEST_NOT_FOUND");
      }

      const approved = await tx.participation.update({
        where: { id: targetParticipation.id },
        data: { status: "Accepted" }
      });

      // Reject all other join requests for this mission
      await tx.participation.updateMany({
        where: {
          missionId: Number(id),
          id: { not: targetParticipation.id },
          status: "Requested"
        },
        data: { status: "Rejected" }
      });

      return approved;
    });

    // Real-time Push Notification to Participant
    try {
      const mission = await prisma.mission.findUnique({
        where: { id: Number(id) },
        select: { title: true }
      });
      const host = await prisma.user.findUnique({
        where: { id: Number(creatorId) },
        select: { name: true }
      });
      if (mission) {
        const supabaseClient = require("../config/supabase");
        if (supabaseClient) {
          const channel = supabaseClient.channel(`notifications:${participantId}`);
          channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              channel.send({
                type: "broadcast",
                event: "push_notification",
                payload: {
                  title: "Request Approved!",
                  message: `${host?.name || "Host"} approved your request to join: "${mission.title}"`,
                  type: "request_approved",
                  missionId: Number(id)
                }
              }).catch(err => console.error("Realtime notification broadcast failed:", err));
            }
          });
        }
      }
    } catch (err) {
      console.error("Error sending approval notification:", err);
    }

    res.json({
      mission_id: Number(id),
      participant_id: Number(participantId),
      status: result.status
    });
  } catch (error) {
    if (error.message === "MISSION_NOT_FOUND") {
      return res.status(404).json({ error: "Mission not found." });
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json({ error: "Only the mission creator can approve requests." });
    }
    if (error.message === "REQUEST_NOT_FOUND") {
      return res.status(404).json({ error: "Join request not found." });
    }
    throw error;
  }
}

async function getCategories(req, res) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" }
    });
    res.json(
      categories.map((c) => ({
        id: c.id,
        categoryName: c.categoryName,
        emoji: c.emoji || null,
        colorHex: c.colorHex || "#a1a1aa"
      }))
    );
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json([
      { id: 1, categoryName: "Coding", emoji: null, colorHex: "#3b82f6" },
      { id: 2, categoryName: "AI", emoji: null, colorHex: "#8b5cf6" },
      { id: 3, categoryName: "Startups", emoji: null, colorHex: "#f59e0b" },
      { id: 4, categoryName: "Hackathons", emoji: null, colorHex: "#ef4444" },
      { id: 5, categoryName: "Open Source", emoji: null, colorHex: "#10b981" },
      { id: 6, categoryName: "Design", emoji: null, colorHex: "#ec4899" },
      { id: 7, categoryName: "Content Creation", emoji: null, colorHex: "#f97316" },
      { id: 8, categoryName: "Fitness", emoji: null, colorHex: "#14b8a6" },
      { id: 9, categoryName: "Study Sessions", emoji: null, colorHex: "#6366f1" },
      { id: 10, categoryName: "Research", emoji: null, colorHex: "#0ea5e9" },
      { id: 11, categoryName: "Placements", emoji: null, colorHex: "#e11d48" },
      { id: 12, categoryName: "Competitive Programming", emoji: null, colorHex: "#eab308" },
      { id: 13, categoryName: "Reading", emoji: null, colorHex: "#a855f7" },
      { id: 14, categoryName: "Languages", emoji: null, colorHex: "#06b6d4" },
      { id: 15, categoryName: "Career", emoji: null, colorHex: "#64748b" },
      { id: 16, categoryName: "Projects", emoji: null, colorHex: "#f43f5e" },
      { id: 17, categoryName: "Networking", emoji: null, colorHex: "#22c55e" },
      { id: 18, categoryName: "Events", emoji: null, colorHex: "#d946ef" },
      { id: 19, categoryName: "Other", emoji: null, colorHex: "#a1a1aa" }
    ]);
  }
}

async function getCampuses(req, res) {
  try {
    const colleges = await prisma.college.findMany({
      orderBy: { shortName: "asc" }
    });
    // Return in a format compatible with the existing frontend
    res.json(
      colleges.map((c) => ({
        id: c.id,
        name: c.shortName,
        location: `${c.city}, ${c.state}`
      }))
    );
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json([
      { id: 1, name: "SRM IST, Kattankulathur (KTR)", location: "Chennai, Tamil Nadu" },
      { id: 2, name: "Taylor's University", location: "Subang Jaya, Selangor" }
    ]);
  }
}

async function submitVibeCheck(req, res) {
  const { id } = req.params;
  const { raterId, rating } = req.body;

  if (!raterId || !["W", "L"].includes(rating)) {
    return res.status(400).json({ error: "raterId and rating ('W' or 'L') are required." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const participation = await tx.participation.findFirst({
        where: {
          missionId: Number(id),
          status: { in: ["Executing", "Completed"] }
        },
        include: {
          mission: true
        }
      });

      if (!participation) {
        throw new Error("NOT_FOUND");
      }

      const numericRaterId = Number(raterId);
      const isCreator = participation.mission.createdBy === numericRaterId;
      const isParticipant = participation.userId === numericRaterId;

      if (!isCreator && !isParticipant) {
        throw new Error("UNAUTHORIZED");
      }

      let updatedRatingField = {};
      let targetUserId = null;
      let auraDelta = rating === "W" ? 2 : -1;
      let baseAuraDelta = 0;

      if (isCreator) {
        if (participation.creatorVibeRating !== null) {
          throw new Error("ALREADY_RATED");
        }
        updatedRatingField = { creatorVibeRating: rating };
        targetUserId = participation.userId;
        baseAuraDelta = 10; // Participant base Completion reward
      } else {
        if (participation.participantVibeRating !== null) {
          throw new Error("ALREADY_RATED");
        }
        updatedRatingField = { participantVibeRating: rating };
        targetUserId = participation.mission.createdBy;
        baseAuraDelta = 5; // Creator base Hosting reward
      }

      const updatedParticipation = await tx.participation.update({
        where: { id: participation.id },
        data: updatedRatingField
      });

      const totalDelta = baseAuraDelta + auraDelta;
      if (targetUserId) {
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            reputationScore: {
              increment: totalDelta
            }
          }
        });
      }

      // Mark status as Completed once both ratings are submitted
      let finalStatus = participation.status;
      if (
        (isCreator && updatedParticipation.participantVibeRating !== null) ||
        (isParticipant && updatedParticipation.creatorVibeRating !== null)
      ) {
        finalStatus = "Completed";
        await tx.participation.update({
          where: { id: participation.id },
          data: { status: "Completed" }
        });
      }

      return {
        status: finalStatus,
        targetUserId,
        auraDelta: totalDelta
      };
    });

    res.json({
      mission_id: Number(id),
      status: result.status,
      rated_user_id: result.targetUserId,
      aura_delta: result.auraDelta
    });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Active participation not found." });
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json({ error: "Unauthorized vibe check." });
    }
    if (error.message === "ALREADY_RATED") {
      return res.status(409).json({ error: "Vibe check already submitted." });
    }
    throw error;
  }
}

module.exports = {
  createMission,
  getMissionFeed,
  acceptMission,
  passMission,
  getActiveMissions,
  submitAttendance,
  approveParticipant,
  getCategories,
  getCampuses,
  submitVibeCheck
};
