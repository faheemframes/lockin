const prisma = require("../config/db");
const { isDbUnavailable } = require("../utils/dbFallback");

const SIDE_QUEST_LIMIT = 3;

/** Deterministic shuffle so the same user sees a stable feed within a day. */
function seededShuffle(array, seed) {
  const copy = [...array];
  let s = Number(seed) || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function daySeed(userId) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return Number(`${day}${Number(userId) || 0}`) || Number(day);
}

function interleaveSideQuests(missions, sideQuests) {
  if (!sideQuests.length) return missions;
  if (!missions.length) return sideQuests;

  const result = [...missions];
  const positions = new Set();
  // Prefer early slots for cold-start visibility, then spread remaining
  const preferred = [0, 2, 4, 1, 3, 5];
  let cursor = 0;

  for (const quest of sideQuests) {
    let insertAt = preferred[cursor];
    cursor += 1;
    while (positions.has(insertAt) && insertAt <= result.length) {
      insertAt += 1;
    }
    if (insertAt > result.length) insertAt = result.length;
    positions.add(insertAt);
    result.splice(insertAt, 0, quest);
  }

  return result;
}

function mapTemplateToFeedItem(template, categoryLookup) {
  const categoryMeta = template.categoryId ? categoryLookup.get(template.categoryId) : null;
  const tasks = Array.isArray(template.defaultTasks) ? template.defaultTasks : [];

  return {
    id: `sq-${template.id}`,
    template_id: template.id,
    is_side_quest: true,
    item_type: "side_quest",
    creator_id: null,
    title: template.title,
    description: template.description,
    location: null,
    datetime: null,
    creator_name: "LOCKIN",
    creator_department: "Curated",
    category_name: categoryMeta?.categoryName || template.category,
    category_id: template.categoryId,
    category_emoji: categoryMeta?.emoji || null,
    category_color: categoryMeta?.colorHex || template.coverColor || "#a1a1aa",
    focus_duration: template.estimatedDuration,
    estimated_duration: template.estimatedDuration,
    difficulty: template.difficulty,
    default_tasks: tasks,
    mission_type: "side_quest",
    cover_color: template.coverColor,
    cover_image: template.coverImage,
    locked_in_count: 0,
    attendees: []
  };
}

async function getActiveSideQuests(categoryId, limit = SIDE_QUEST_LIMIT, userId = 0) {
  const where = { isActive: true };
  if (categoryId && categoryId !== "all") {
    where.categoryId = Number(categoryId);
  }

  const templates = await prisma.missionTemplate.findMany({ where });
  if (!templates.length) return [];

  const categories = await prisma.category.findMany({
    where: {
      id: { in: templates.map((t) => t.categoryId).filter(Boolean) }
    }
  });
  const categoryLookup = new Map(categories.map((c) => [c.id, c]));

  const selected = seededShuffle(templates, daySeed(userId)).slice(
    0,
    Math.min(limit, templates.length)
  );
  return selected.map((t) => mapTemplateToFeedItem(t, categoryLookup));
}

async function getTemplateById(req, res) {
  const { id } = req.params;
  try {
    const template = await prisma.missionTemplate.findFirst({
      where: { id: Number(id), isActive: true }
    });
    if (!template) {
      return res.status(404).json({ error: "Side Quest not found." });
    }

    let categoryMeta = null;
    if (template.categoryId) {
      categoryMeta = await prisma.category.findUnique({ where: { id: template.categoryId } });
    }

    res.json(mapTemplateToFeedItem(template, new Map(categoryMeta ? [[categoryMeta.id, categoryMeta]] : [])));
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.status(503).json({ error: "Side Quests unavailable offline." });
  }
}

/**
 * Create a real Mission from a Side Quest template.
 * Reuses the same Mission + Participation + Task tables — no special execution path.
 */
async function lockInFromTemplate(req, res) {
  const { templateId, creator_id, missionType, location, datetime, focusDuration } = req.body;
  const isSolo = missionType !== "group";

  if (!templateId || !creator_id) {
    return res.status(400).json({ error: "templateId and creator_id are required." });
  }

  if (!isSolo && (!location || !datetime)) {
    return res.status(400).json({ error: "location and datetime are required for group missions." });
  }

  try {
    const template = await prisma.missionTemplate.findFirst({
      where: { id: Number(templateId), isActive: true }
    });

    if (!template) {
      return res.status(404).json({ error: "Side Quest not found." });
    }

    const creatorUser = await prisma.user.findUnique({
      where: { id: Number(creator_id) },
      select: { collegeId: true, name: true, department: true }
    });

    if (!creatorUser) {
      return res.status(400).json({ error: "User session is invalid. Please log out and sign in again." });
    }

    // One active lock-in per Side Quest title — blocks rapid double-swipes
    if (isSolo) {
      const existingActive = await prisma.participation.findFirst({
        where: {
          userId: Number(creator_id),
          status: { in: ["Accepted", "Executing"] },
          showedUp: null,
          mission: {
            title: template.title,
            missionType: "solo",
            createdBy: Number(creator_id)
          }
        },
        include: {
          mission: {
            include: { creator: { select: { name: true, department: true } } }
          }
        }
      });

      if (existingActive?.mission) {
        const m = existingActive.mission;
        return res.status(200).json({
          id: m.id,
          creator_id: m.createdBy,
          title: m.title,
          description: m.description,
          location: m.location,
          datetime: m.datetime ? m.datetime.toISOString() : null,
          creator_name: m.creator?.name || creatorUser.name || "Unknown",
          creator_department: m.creator?.department || creatorUser.department || "Creator",
          verification_code: m.verificationCode,
          focus_duration: m.focusDuration,
          mission_type: m.missionType,
          cover_color: m.coverColor,
          cover_image: m.coverImage,
          from_template_id: template.id,
          already_locked: true,
          tasks_created: 0
        });
      }

      const activeCount = await prisma.participation.count({
        where: {
          userId: Number(creator_id),
          status: "Accepted",
          showedUp: null
        }
      });
      if (activeCount >= 3) {
        return res.status(423).json({
          error: "Runway full. Mark attendance on your active missions before locking in more."
        });
      }
    }

    const tasks = Array.isArray(template.defaultTasks) ? template.defaultTasks : [];
    const verificationCode = String(Math.floor(1000 + Math.random() * 9000));
    const duration = focusDuration
      ? Number(focusDuration)
      : (template.estimatedDuration || 25);

    const mission = await prisma.$transaction(async (tx) => {
      const created = await tx.mission.create({
        data: {
          title: template.title,
          description: template.description,
          datetime: datetime ? new Date(datetime) : (isSolo ? new Date() : null),
          location: isSolo ? "Solo" : String(location).trim(),
          categoryId: template.categoryId || 19,
          createdBy: Number(creator_id),
          collegeId: creatorUser.collegeId,
          focusDuration: duration,
          verificationCode,
          missionType: isSolo ? "solo" : "group",
          coverColor: template.coverColor || null,
          coverImage: template.coverImage || null
        },
        include: {
          creator: { select: { name: true, department: true } }
        }
      });

      if (isSolo) {
        await tx.participation.create({
          data: {
            userId: Number(creator_id),
            missionId: created.id,
            status: "Accepted"
          }
        });
      }

      if (tasks.length > 0) {
        await tx.task.createMany({
          data: tasks.map((title, index) => ({
            title: String(title).slice(0, 200),
            position: index,
            missionId: created.id
          }))
        });
      }

      return created;
    });

    res.status(201).json({
      id: mission.id,
      creator_id: mission.createdBy,
      title: mission.title,
      description: mission.description,
      location: mission.location,
      datetime: mission.datetime ? mission.datetime.toISOString() : null,
      creator_name: mission.creator?.name || creatorUser.name || "Unknown",
      creator_department: mission.creator?.department || creatorUser.department || "Creator",
      verification_code: mission.verificationCode,
      focus_duration: mission.focusDuration,
      mission_type: mission.missionType,
      cover_color: mission.coverColor,
      cover_image: mission.coverImage,
      from_template_id: template.id,
      tasks_created: tasks.length
    });
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.status(503).json({ error: "Could not lock in Side Quest while offline." });
  }
}

module.exports = {
  SIDE_QUEST_LIMIT,
  getActiveSideQuests,
  getTemplateById,
  lockInFromTemplate,
  interleaveSideQuests
};
