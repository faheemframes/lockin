const crypto = require("crypto");
const prisma = require("../config/db");
const { runTx } = require("../utils/tx");
const { isDbUnavailable } = require("../utils/dbFallback");
const { toId, cleanText, safeImageRef, safeColor, newCheckInCode, rateLimit } = require("../utils/security");
const { notify } = require("../utils/notify");

// Every handler here runs behind getAuthUser(): req.userId is the verified
// session user and identity fields in req.body/req.query were overwritten.

async function createMission(req, res) {
  const creatorId = req.userId;
  const b = req.body || {};
  const isSolo = b.missionType === "solo";

  const title = cleanText(b.title, 100);
  const description = cleanText(b.description, 2000);
  const location = isSolo ? "Solo" : cleanText(b.location, 100);
  const categoryId = toId(b.categoryId) || 1;
  const focusDuration = Math.round(Number(b.focusDuration) || 25);
  const coverColor = safeColor(b.coverColor);
  const coverImage = safeImageRef(b.coverImage, { allowGradient: true });

  if (!title || !description || (!isSolo && (!location || !b.datetime))) {
    return res.status(400).json({ error: "Title, description, location and time are required." });
  }
  if (focusDuration < 5 || focusDuration > 240) {
    return res.status(400).json({ error: "Focus duration must be between 5 and 240 minutes." });
  }
  if (coverColor === undefined || coverImage === undefined) {
    return res.status(400).json({ error: "Cover must be an uploaded image or one of the presets." });
  }

  let datetime = new Date();
  if (!isSolo) {
    datetime = new Date(b.datetime);
    const now = Date.now();
    if (isNaN(datetime.getTime()) || datetime.getTime() < now - 5 * 60e3 || datetime.getTime() > now + 90 * 86400e3) {
      return res.status(400).json({ error: "Pick a time between now and 90 days from now." });
    }
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) return res.status(400).json({ error: "Unknown category." });

  const creatorUser = await prisma.user.findUnique({ where: { id: creatorId }, select: { collegeId: true } });
  if (!creatorUser) return res.status(403).json({ error: "Finish setting up your profile first." });

  const mission = await prisma.mission.create({
    data: {
      title,
      description,
      datetime,
      location,
      categoryId,
      createdBy: creatorId,
      collegeId: creatorUser.collegeId,
      focusDuration,
      verificationCode: newCheckInCode(),
      missionType: isSolo ? "solo" : "group",
      coverColor: coverColor || null,
      coverImage: coverImage || null
    },
    include: { creator: { select: { name: true, department: true } } }
  });

  if (isSolo) {
    const startNow = b.startNow !== false;
    await prisma.participation.create({
      data: {
        userId: creatorId,
        missionId: mission.id,
        status: startNow ? "Executing" : "Accepted",
        workStartedAt: startNow ? new Date() : null,
        workDuration: focusDuration,
        showedUp: startNow ? true : null
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
}

async function getMissionFeed(req, res) {
  const userId = req.userId;
  const categoryId = toId(req.query.categoryId);

  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { collegeId: true } });
  const twelveHoursAgo = new Date(Date.now() - 12 * 3600e3);

  // Campus-exclusive: your college's missions (and legacy campus-less ones). No cross-campus fallback.
  const where = {
    createdBy: { not: userId },
    datetime: { gte: twelveHoursAgo },
    missionType: { not: "solo" },
    OR: viewer && viewer.collegeId ? [{ collegeId: viewer.collegeId }, { collegeId: null }] : [{ collegeId: null }],
    participations: { none: { userId } }
  };
  if (categoryId) where.categoryId = categoryId;

  const missions = await prisma.mission.findMany({
    where,
    orderBy: { datetime: "asc" },
    take: 50,
    include: {
      category: true,
      creator: { select: { name: true, username: true, department: true, reputationScore: true } },
      participations: {
        where: { status: { in: ["Accepted", "Executing", "Completed"] } },
        include: { user: { select: { id: true, name: true, department: true, reputationScore: true } } }
      }
    }
  });

  const rows = missions.map((m) => {
    const attendees = [];
    if (m.creator) {
      attendees.push({ id: m.createdBy, name: m.creator.name, department: m.creator.department || "Host", reputation_score: m.creator.reputationScore || 0, is_host: true });
    }
    for (const p of m.participations || []) {
      if (!p.user || p.user.id === m.createdBy) continue;
      attendees.push({ id: p.user.id, name: p.user.name, department: p.user.department || "Student", reputation_score: p.user.reputationScore || 0, is_host: false });
    }
    return {
      id: m.id,
      creator_id: m.createdBy,
      title: m.title,
      description: m.description,
      location: m.location,
      datetime: m.datetime ? m.datetime.toISOString() : null,
      creator_name: m.creator?.name || "Unknown",
      creator_username: m.creator?.username || null,
      creator_department: m.creator?.department || "Creator",
      category_name: m.category?.categoryName || "Other",
      category_id: m.categoryId,
      category_emoji: m.category?.emoji || null,
      category_color: m.category?.colorHex || null,
      focus_duration: m.focusDuration,
      mission_type: m.missionType,
      cover_color: m.coverColor,
      cover_image: m.coverImage,
      locked_in_count: attendees.length,
      attendees
    };
  });

  res.json(rows);
}

async function acceptMission(req, res) {
  const userId = req.userId;
  const missionId = toId(req.params.id);
  if (!missionId) return res.status(400).json({ error: "Invalid mission." });

  try {
    const result = await runTx(async (tx) => {
      // Sequential on purpose: one transaction is one connection.
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, collegeId: true, name: true } });
      const mission = await tx.mission.findUnique({ where: { id: missionId } });
      if (!mission) throw new Error("NOT_FOUND");
      if (mission.createdBy === userId) throw new Error("OWN_MISSION");
      if (mission.missionType === "solo") throw new Error("NOT_FOUND");
      if (mission.collegeId && user.collegeId && mission.collegeId !== user.collegeId) throw new Error("NOT_FOUND");
      if (mission.datetime && mission.datetime.getTime() < Date.now() - 12 * 3600e3) throw new Error("EXPIRED");

      const existing = await tx.participation.findUnique({ where: { unique_user_mission: { userId, missionId } } });
      if (existing) throw new Error("ALREADY");

      const activeCount = await tx.participation.count({
        where: { userId, status: { in: ["Requested", "Accepted", "Executing"] } }
      });
      if (activeCount >= 3) throw new Error("LOCKED_OUT");

      const participation = await tx.participation.create({ data: { userId, missionId, status: "Requested" } });
      return { participation, mission, user };
    });

    if (result.mission.createdBy) {
      await notify(result.mission.createdBy, {
        type: "join_request",
        title: `${result.user?.name || "Someone"} wants to join ${result.mission.title}`,
        body: "Approve them from your Queue.",
        actorId: userId,
        missionId
      });
    }

    res.status(201).json({ mission_id: result.participation.missionId, user_id: result.participation.userId, status: result.participation.status });
  } catch (error) {
    const map = {
      NOT_FOUND: [404, "Mission not found."],
      OWN_MISSION: [400, "That's your own mission."],
      EXPIRED: [410, "This mission has already happened."],
      ALREADY: [409, "You've already locked in to this one."],
      LOCKED_OUT: [423, "Queue full. Check in or finish one of your 3 active missions first."]
    };
    if (map[error.message]) return res.status(map[error.message][0]).json({ error: map[error.message][1] });
    throw error;
  }
}

async function passMission(req, res) {
  res.json({ mission_id: Number(req.params.id), passed: true });
}

async function getActiveMissions(req, res) {
  const userId = req.userId;
  const numericUserId = req.userId;
  try {
    // 1. Fetch missions accepted by this user (exclude solo to prevent duplicates)
    const acceptedQuery = prisma.participation.findMany({
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
    const hostedQuery = prisma.participation.findMany({
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
    const createdQuery = prisma.mission.findMany({
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

    // The three lookups are independent: run them together, not one after another.
    const [accepted, hosted, createdMissions] = await Promise.all([acceptedQuery, hostedQuery, createdQuery]);

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
      .map((p) => {
        if (!p.mission) return null;
        const attendees = buildAttendees(p.mission);
        const isApproved = ["Accepted", "Executing", "Completed"].includes(p.status);
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
          is_event: Boolean(p.mission.isEvent),
          require_approval: Boolean(p.mission.requireApproval),
          registration_q: p.mission.registrationQ || null,
          secret_info: isApproved ? (p.mission.secretInfo || null) : null,
          max_capacity: p.mission.maxCapacity || null,
          application_note: p.applicationNote || null,
          locked_in_count: attendees.length,
          attendees: attendees
        };
      })
      .filter(Boolean);

    // Full roster per hosted mission. The queue shows one card per mission, so
    // without this a host with several join requests only ever saw the first.
    const rosterByMission = new Map();
    for (const p of hosted) {
      if (!p.mission || p.mission.missionType === "solo" || p.userId === p.mission.createdBy) continue;
      if (!rosterByMission.has(p.missionId)) rosterByMission.set(p.missionId, { pending: [], going: [] });
      const entry = {
        id: p.id,
        participant_id: p.userId,
        user_id: p.userId,
        name: p.user?.name || "Student",
        department: p.user?.department || "Student",
        reputation_score: p.user?.reputationScore || 0,
        reputation_points: p.user?.reputationScore || 0,
        status: p.status,
        showed_up: p.showedUp,
        application_note: p.applicationNote || null
      };
      const r = rosterByMission.get(p.missionId);
      if (p.status === "Requested") r.pending.push(entry);
      else if (["Accepted", "Executing", "Completed"].includes(p.status)) r.going.push(entry);
    }

    // When a hosted mission has several participations, its card follows the
    // one that needs the host most: a live session, then a confirmed partner,
    // then an open request, then history.
    const hostPriority = { Executing: 0, Accepted: 1, Requested: 2, Completed: 3, Missed: 4 };
    const hostedSorted = [...hosted].sort((a, b) => (hostPriority[a.status] ?? 9) - (hostPriority[b.status] ?? 9));

    const hostedRows = hostedSorted
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
          is_event: Boolean(p.mission.isEvent),
          require_approval: Boolean(p.mission.requireApproval),
          registration_q: p.mission.registrationQ || null,
          secret_info: p.mission.secretInfo || null,
          max_capacity: p.mission.maxCapacity || null,
          locked_in_count: attendees.length,
          attendees: attendees,
          roster: isSolo ? undefined : rosterByMission.get(p.missionId) || { pending: [], going: [] }
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
          is_event: Boolean(m.isEvent),
          require_approval: Boolean(m.requireApproval),
          registration_q: m.registrationQ || null,
          secret_info: m.secretInfo || null,
          max_capacity: m.maxCapacity || null,
          locked_in_count: attendees.length,
          attendees: attendees
        };
      });

    // Deduplicate by mission.id + role so each mission is only listed once in queue
    const seen = new Set();
    const rows = [];
    for (const item of [...acceptedRows, ...hostedRows, ...pendingRows]) {
      if (!item) continue;
      const key = `${item.id}-${item.role}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(item);
      }
    }

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
    throw error;
  }
}

async function submitAttendance(req, res) {
  const callerId = req.userId;
  const missionId = toId(req.params.id);
  const { showedUp, code } = req.body || {};
  const participantId = toId(req.body && req.body.participantId) || callerId;

  if (!missionId) return res.status(400).json({ error: "Invalid mission." });
  if (typeof showedUp !== "boolean") return res.status(400).json({ error: "showedUp must be true or false." });

  const markingSomeoneElse = participantId !== callerId;
  if (markingSomeoneElse && showedUp) {
    return res.status(403).json({ error: "Only the participant can check themselves in." });
  }

  if (showedUp) {
    // Slow down code guessing: 6 tries per user per mission per 10 minutes.
    const rl = rateLimit(`checkin:${callerId}:${missionId}`, 6, 10 * 60e3);
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfter));
      return res.status(429).json({ error: "Too many attempts. Ask the host for the code and try again in a few minutes." });
    }
  }

  try {
    const result = await runTx(async (tx) => {
      const participant = await tx.participation.findFirst({
        where: { missionId, userId: participantId },
        include: { mission: true }
      });
      if (!participant) throw new Error("NOT_FOUND");

      const mission = participant.mission;
      if (markingSomeoneElse && mission.createdBy !== callerId) throw new Error("FORBIDDEN");
      if (participant.status !== "Accepted" || participant.showedUp !== null) throw new Error("ALREADY_SUBMITTED");

      const isSolo = mission.missionType === "solo";
      const startsAt = mission.datetime ? mission.datetime.getTime() : Date.now();
      if (!isSolo && Date.now() < startsAt - 15 * 60e3) throw new Error("TOO_EARLY");

      if (showedUp) {
        if (!isSolo) {
          const expected = Buffer.from(String(mission.verificationCode || ""));
          const given = Buffer.from(String(code || "").trim().slice(0, 10));
          if (expected.length === 0 || expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
            throw new Error("INVALID_CODE");
          }
        }
        const updated = await tx.participation.update({
          where: { id: participant.id },
          data: { status: "Executing", workStartedAt: new Date(), workDuration: mission.focusDuration, showedUp: true }
        });
        return { status: "Executing", workStartedAt: updated.workStartedAt, userId: participantId, mission };
      }

      await tx.participation.update({ where: { id: participant.id }, data: { status: "Missed", showedUp: false } });
      await tx.user.update({ where: { id: participantId }, data: { reputationScore: { decrement: 5 } } });
      return { status: "Missed", workStartedAt: null, userId: participantId };
    });

    if (result.status === "Executing" && result.mission && result.mission.missionType !== "solo" && result.mission.createdBy !== result.userId) {
      const who = await prisma.user.findUnique({ where: { id: result.userId }, select: { name: true } });
      await notify(result.mission.createdBy, {
        type: "checked_in",
        title: `${who?.name || "Your partner"} checked in to ${result.mission.title}`,
        body: "They're locked in. Rate the session when you're done.",
        actorId: result.userId,
        missionId
      });
    }

    res.json({
      mission_id: missionId,
      user_id: result.userId,
      status: result.status,
      work_started_at: result.workStartedAt ? result.workStartedAt.toISOString() : null
    });
  } catch (error) {
    const map = {
      NOT_FOUND: [404, "You're not on this mission."],
      FORBIDDEN: [403, "Only the host can mark someone as a no-show."],
      ALREADY_SUBMITTED: [409, "Check-in has already been recorded."],
      TOO_EARLY: [409, "Check-in opens 15 minutes before the start time."],
      INVALID_CODE: [400, "That code doesn't match. Ask the host again."]
    };
    if (map[error.message]) return res.status(map[error.message][0]).json({ error: map[error.message][1] });
    throw error;
  }
}

async function approveParticipant(req, res) {
  const creatorId = req.userId;
  const missionId = toId(req.params.id);
  const participantId = toId(req.body && req.body.participantId);
  if (!missionId || !participantId) return res.status(400).json({ error: "participantId is required." });

  try {
    const result = await runTx(async (tx) => {
      const mission = await tx.mission.findUnique({ where: { id: missionId } });
      if (!mission) throw new Error("MISSION_NOT_FOUND");
      if (mission.createdBy !== creatorId) throw new Error("UNAUTHORIZED");

      const target = await tx.participation.findFirst({ where: { missionId, userId: participantId, status: "Requested" } });
      if (!target) throw new Error("REQUEST_NOT_FOUND");

      const approved = await tx.participation.update({ where: { id: target.id }, data: { status: "Accepted" } });
      await tx.participation.updateMany({
        where: { missionId, id: { not: target.id }, status: "Requested" },
        data: { status: "Rejected" }
      });
      return { approved, mission };
    });

    const host = await prisma.user.findUnique({ where: { id: creatorId }, select: { name: true } });
    await notify(participantId, {
      type: "request_approved",
      title: `${host?.name || "The host"} approved you for ${result.mission.title}`,
      body: "You're in. Check in with the host's code when it starts.",
      actorId: creatorId,
      missionId
    });

    res.json({ mission_id: missionId, participant_id: participantId, status: result.approved.status });
  } catch (error) {
    const map = {
      MISSION_NOT_FOUND: [404, "Mission not found."],
      UNAUTHORIZED: [403, "Only the mission's host can approve requests."],
      REQUEST_NOT_FOUND: [404, "Join request not found."]
    };
    if (map[error.message]) return res.status(map[error.message][0]).json({ error: map[error.message][1] });
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
    // Prioritize SRM KTR, followed by other SRM campuses, then alphabetical
    const sorted = [...colleges].sort((a, b) => {
      const aIsKtr = a.shortName === "SRM KTR" || a.collegeName?.includes("Kattankulathur");
      const bIsKtr = b.shortName === "SRM KTR" || b.collegeName?.includes("Kattankulathur");
      if (aIsKtr && !bIsKtr) return -1;
      if (!aIsKtr && bIsKtr) return 1;
      return (a.shortName || a.collegeName || "").localeCompare(b.shortName || b.collegeName || "");
    });
    // Return in a format compatible with the existing frontend
    res.json(
      sorted.map((c) => ({
        id: c.id,
        name: c.shortName ? `${c.shortName} (${c.collegeName})` : c.collegeName,
        shortName: c.shortName,
        location: `${c.city}, ${c.state}`
      }))
    );
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json([
      { id: 1634, name: "SRM KTR (SRM Institute of Science and Technology, Kattankulathur)", location: "Chengalpattu, Tamil Nadu" }
    ]);
  }
}

async function submitVibeCheck(req, res) {
  const raterId = req.userId;
  const missionId = toId(req.params.id);
  const { rating } = req.body || {};
  if (!missionId || !["W", "L"].includes(rating)) {
    return res.status(400).json({ error: "rating must be 'W' or 'L'." });
  }

  try {
    const result = await runTx(async (tx) => {
      const mission = await tx.mission.findUnique({ where: { id: missionId } });
      if (!mission) throw new Error("NOT_FOUND");
      const isCreator = mission.createdBy === raterId;

      // The participation being rated: the rater's own (participant) or the
      // single approved partner's (host). Group missions approve one partner.
      const participation = await tx.participation.findFirst({
        where: isCreator
          ? { missionId, userId: { not: raterId }, status: { in: ["Executing", "Completed"] } }
          : { missionId, userId: raterId, status: { in: ["Executing", "Completed"] } }
      });
      if (!participation) throw new Error(isCreator ? "NOT_FOUND" : "UNAUTHORIZED");

      const delta = rating === "W" ? 2 : -1;
      let field;
      let targetUserId;
      let base;
      if (isCreator) {
        if (participation.creatorVibeRating !== null) throw new Error("ALREADY_RATED");
        field = { creatorVibeRating: rating };
        targetUserId = participation.userId;
        base = 10; // participant completion reward
      } else {
        if (participation.participantVibeRating !== null) throw new Error("ALREADY_RATED");
        field = { participantVibeRating: rating };
        targetUserId = mission.createdBy;
        base = 5; // host reward
      }

      const updated = await tx.participation.update({ where: { id: participation.id }, data: field });
      if (targetUserId) {
        await tx.user.update({ where: { id: targetUserId }, data: { reputationScore: { increment: base + delta } } });
      }

      let status = participation.status;
      if (updated.creatorVibeRating !== null && updated.participantVibeRating !== null) {
        status = "Completed";
        await tx.participation.update({ where: { id: participation.id }, data: { status } });
      }
      return { status, targetUserId, auraDelta: base + delta };
    });

    if (result.targetUserId) {
      const [rater, m] = await Promise.all([
        prisma.user.findUnique({ where: { id: raterId }, select: { name: true } }),
        prisma.mission.findUnique({ where: { id: missionId }, select: { title: true } })
      ]);
      await notify(result.targetUserId, {
        type: "rated",
        title: `${rater?.name || "Someone"} rated your session ${rating}`,
        body: `${m?.title || "Mission"} · ${result.auraDelta >= 0 ? "+" : ""}${result.auraDelta} Motion`,
        actorId: raterId,
        missionId
      });
    }
    res.json({ mission_id: missionId, status: result.status, rated_user_id: result.targetUserId, aura_delta: result.auraDelta });
  } catch (error) {
    const map = {
      NOT_FOUND: [404, "Active participation not found."],
      UNAUTHORIZED: [403, "You weren't on this mission."],
      ALREADY_RATED: [409, "You've already rated this session."]
    };
    if (map[error.message]) return res.status(map[error.message][0]).json({ error: map[error.message][1] });
    throw error;
  }
}

async function declineParticipant(req, res) {
  const creatorId = req.userId;
  const missionId = toId(req.params.id);
  const participantId = toId(req.body && (req.body.participantId || req.body.userId));
  if (!missionId || !participantId) return res.status(400).json({ error: "participantId is required." });

  try {
    const mission = await prisma.mission.findUnique({ where: { id: missionId } });
    if (!mission) return res.status(404).json({ error: "Mission not found." });
    if (mission.createdBy !== creatorId) return res.status(403).json({ error: "Only the mission host can decline requests." });

    const target = await prisma.participation.findFirst({
      where: { missionId, userId: participantId, status: "Requested" }
    });
    if (!target) return res.status(404).json({ error: "Join request not found." });

    await prisma.participation.update({
      where: { id: target.id },
      data: { status: "Rejected" }
    });

    res.json({ success: true, mission_id: missionId, participant_id: participantId, status: "Rejected" });
  } catch (error) {
    console.error("Decline participant error:", error);
    res.status(500).json({ error: "Failed to decline participant." });
  }
}

async function hostBroadcast(req, res) {
  const hostId = req.userId || (req.body && req.body.hostId);
  const missionId = toId(req.params.id);
  const { message } = req.body || {};
  if (!missionId) return res.status(400).json({ error: "missionId is required." });
  if (!message || !message.trim()) return res.status(400).json({ error: "Message is required." });

  try {
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        participations: {
          where: { status: { in: ["Accepted", "Executing"] } },
          select: { userId: true }
        }
      }
    });

    if (!mission) return res.status(404).json({ error: "Mission not found." });
    if (mission.createdBy !== hostId) return res.status(403).json({ error: "Only the host can broadcast updates." });

    for (const p of mission.participations) {
      if (p.userId === hostId) continue;
      await notify(p.userId, {
        type: "host_broadcast",
        title: `Update from the host · ${mission.title}`,
        body: message.trim().slice(0, 500),
        actorId: hostId,
        missionId
      });
    }

    res.json({ success: true, count: mission.participations.length });
  } catch (error) {
    console.error("Host broadcast error:", error);
    res.status(500).json({ error: "Failed to broadcast update." });
  }
}

async function cancelMission(req, res) {
  const missionId = toId(req.params.id);
  const userId = req.userId || (req.body && toId(req.body.userId));

  if (!missionId) return res.status(400).json({ error: "Invalid mission id." });
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        participations: true
      }
    });

    if (!mission) {
      await prisma.participation.deleteMany({
        where: { missionId, userId }
      }).catch(() => {});
      return res.json({ success: true, message: "Mission removed from queue." });
    }

    const isCreator = mission.createdBy === userId;
    const userParticipation = mission.participations.find((p) => p.userId === userId);

    if (isCreator) {
      if (mission.missionType !== "solo") {
        for (const p of mission.participations) {
          if (p.userId !== userId && ["Accepted", "Requested"].includes(p.status)) {
            await notify(p.userId, {
              type: "mission_cancelled",
              title: "Mission cancelled",
              body: `The host cancelled "${mission.title}".`,
              actorId: userId,
              // No missionId: notifications cascade-delete with their mission,
              // which is deleted right below, so the notice would vanish.
              missionId: null
            });
          }
        }
      }

      await prisma.mission.delete({
        where: { id: missionId }
      });

      return res.json({ success: true, message: "Mission deleted." });
    }

    if (userParticipation) {
      await prisma.participation.delete({
        where: { id: userParticipation.id }
      });

      if (mission.createdBy) {
        const leaver = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true }
        });
        await notify(mission.createdBy, {
          type: "participant_left",
          title: userParticipation.status === "Requested" ? "Request withdrawn" : "Participant left",
          body: `${leaver?.name || "A participant"} left or withdrew from "${mission.title}".`,
          actorId: userId,
          missionId
        });
      }

      return res.json({ success: true, message: "Withdrawn from mission." });
    }

    await prisma.participation.deleteMany({
      where: { missionId, userId }
    }).catch(() => {});

    return res.json({ success: true, message: "Removed from queue." });
  } catch (error) {
    if (isDbUnavailable(error)) {
      return res.json({ success: true, message: "Mission removed." });
    }
    console.error("Error cancelling/deleting mission:", error);
    res.status(500).json({ error: "Failed to remove mission." });
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
  declineParticipant,
  hostBroadcast,
  cancelMission,
  getCategories,
  getCampuses,
  submitVibeCheck
};
