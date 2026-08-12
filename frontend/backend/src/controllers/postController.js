const prisma = require("../config/db");
const { isDbUnavailable } = require("../utils/dbFallback");

// Helper: parse imageUrl column (may be a JSON array string or a single URL)
function parseImageUrls(imageUrlField) {
  if (!imageUrlField) return [];
  try {
    const parsed = JSON.parse(imageUrlField);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (e) {
    // Not JSON — treat as a single URL (backwards compat)
  }
  return [imageUrlField];
}

// Helper: serialize image URLs array to store in DB
function serializeImageUrls(imageUrls, imageUrl) {
  // Prefer imageUrls array; fallback to single imageUrl
  if (Array.isArray(imageUrls) && imageUrls.length > 0) {
    return JSON.stringify(imageUrls.filter(Boolean));
  }
  if (imageUrl) {
    return JSON.stringify([imageUrl]);
  }
  return null;
}

// POST /api/posts
async function createPost(req, res) {
  const { userId, recapId, imageUrl, imageUrls, caption, visibility = "college" } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }

  if (caption && caption.length > 300) {
    return res.status(400).json({ error: "Caption must be 300 characters or less." });
  }

  const validVisibilities = ["college", "followers", "everyone"];
  if (!validVisibilities.includes(visibility)) {
    return res.status(400).json({ error: "Invalid visibility value." });
  }

  try {
    const numericUserId = Number(userId);
    const numericRecapId = recapId ? Number(recapId) : null;
    const serializedImages = serializeImageUrls(imageUrls, imageUrl);

    const post = await prisma.post.create({
      data: {
        userId: numericUserId,
        recapId: numericRecapId,
        imageUrl: serializedImages,
        caption: caption || null,
        visibility
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: true,
            college: true,
            reputationScore: true,
            avatarUrl: true
          }
        },
        recap: true
      }
    });

    const parsedUrls = parseImageUrls(post.imageUrl);

    res.status(201).json({
      ...post,
      imageUrl: parsedUrls[0] || null,
      imageUrls: parsedUrls,
      commentCount: 0,
      reactionCounts: { "🔥": 0, "💀": 0, "❤️": 0, "🧠": 0 },
      userReactions: { "🔥": false, "💀": false, "❤️": false, "🧠": false }
    });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock created post.");
      const mockUrls = Array.isArray(imageUrls) ? imageUrls : (imageUrl ? [imageUrl] : []);
      res.status(201).json({
        id: Math.floor(Math.random() * 1000) + 1000,
        userId: Number(userId),
        recapId: recapId ? Number(recapId) : null,
        imageUrl: mockUrls[0] || null,
        imageUrls: mockUrls,
        caption: caption || null,
        visibility,
        createdAt: new Date().toISOString(),
        user: {
          id: Number(userId),
          name: "Rayaan Arora",
          department: "CSE",
          college: "SRM KTR",
          reputationScore: 240
        },
        recap: null,
        commentCount: 0,
        reactionCounts: { "🔥": 0, "💀": 0, "❤️": 0, "🧠": 0 },
        userReactions: { "🔥": false, "💀": false, "❤️": false, "🧠": false }
      });
      return;
    }
    console.error("Error creating post", error);
    res.status(500).json({ error: "Failed to create post." });
  }
}

// GET /api/posts/feed
async function getPostsFeed(req, res) {
  const userId = Number(req.query.userId);
  const filter = req.query.filter || "everyone"; // "college" | "following" | "everyone"
  const limit = Number(req.query.limit) || 10;
  const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;

  if (isNaN(userId)) {
    return res.status(400).json({ error: "userId query parameter is required." });
  }

  try {
    let whereClause = {};

    // Get user to check college and following
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { collegeId: true }
    });

    if (filter === "college") {
      const collegeId = user ? user.collegeId : null;
      if (collegeId) {
        whereClause = {
          user: { collegeId: collegeId },
          visibility: { in: ["college", "everyone"] }
        };
      } else {
        // Fallback if user has no college: only show their own posts
        whereClause = { userId };
      }
    } else if (filter === "following") {
      const follows = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true }
      });
      const followingIds = follows.map(f => f.followingId);
      // Include following users + current user themselves
      whereClause = {
        userId: { in: [...followingIds, userId] },
        visibility: { in: ["everyone", "followers", "college"] }
      };
    } else {
      // "everyone" (default)
      whereClause = {
        OR: [
          { visibility: "everyone" },
          { userId: userId }
        ]
      };
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
            reputationScore: true,
            avatarUrl: true
          }
        },
        recap: true,
        comments: {
          select: { id: true }
        },
        reactions: {
          select: { userId: true, emoji: true }
        }
      }
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;
    }

    const posts = await prisma.post.findMany(queryOptions);

    const formattedPosts = posts.map(post => {
      const commentCount = post.comments.length;
      const reactionCounts = { "🔥": 0, "💀": 0, "❤️": 0, "🧠": 0 };
      const userReactions = { "🔥": false, "💀": false, "❤️": false, "🧠": false };

      post.reactions.forEach(r => {
        if (reactionCounts[r.emoji] !== undefined) {
          reactionCounts[r.emoji]++;
        }
        if (r.userId === userId) {
          if (userReactions[r.emoji] !== undefined) {
            userReactions[r.emoji] = true;
          }
        }
      });

      const parsedUrls = parseImageUrls(post.imageUrl);

      return {
        id: post.id,
        userId: post.userId,
        recapId: post.recapId,
        imageUrl: parsedUrls[0] || null,
        imageUrls: parsedUrls,
        caption: post.caption,
        visibility: post.visibility,
        createdAt: post.createdAt,
        user: post.user,
        recap: post.recap,
        commentCount,
        reactionCounts,
        userReactions
      };
    });

    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;

    res.json({
      posts: formattedPosts,
      nextCursor
    });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock feed.");
      // Provide clean default posts with no emojis in descriptive labels
      res.json({
        posts: [
          {
            id: 9999,
            userId: 999,
            recapId: 888,
            imageUrl: null,
            imageUrls: [],
            caption: "Crushed a backend migration! Let's lock in.",
            visibility: "everyone",
            createdAt: new Date().toISOString(),
            user: {
              id: 999,
              name: "Faheem",
              department: "CSE",
              college: "SRM KTR",
              reputationScore: 190
            },
            recap: {
              id: 888,
              sessionDuration: 45,
              tasksCompleted: 3,
              streak: 4,
              categorySnapshot: "Development",
              missionTitle: "Database Restructure",
              generatedAt: new Date().toISOString()
            },
            commentCount: 2,
            reactionCounts: { "🔥": 3, "💀": 1, "❤️": 2, "🧠": 4 },
            userReactions: { "🔥": true, "💀": false, "❤️": false, "🧠": true }
          }
        ],
        nextCursor: null
      });
      return;
    }
    console.error("Error fetching posts feed", error);
    res.status(500).json({ error: "Failed to load posts feed." });
  }
}

// GET /api/posts/:id
async function getPostDetail(req, res) {
  const postId = Number(req.params.id);
  const userId = Number(req.query.userId) || -1;

  if (isNaN(postId)) {
    return res.status(400).json({ error: "Invalid post ID." });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: true,
            college: true,
            reputationScore: true,
            avatarUrl: true
          }
        },
        recap: true,
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                department: true
              }
            }
          },
          orderBy: { id: "asc" }
        },
        reactions: {
          select: { userId: true, emoji: true }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found." });
    }

    const reactionCounts = { "🔥": 0, "💀": 0, "❤️": 0, "🧠": 0 };
    const userReactions = { "🔥": false, "💀": false, "❤️": false, "🧠": false };

    post.reactions.forEach(r => {
      if (reactionCounts[r.emoji] !== undefined) {
        reactionCounts[r.emoji]++;
      }
      if (r.userId === userId) {
        if (userReactions[r.emoji] !== undefined) {
          userReactions[r.emoji] = true;
        }
      }
    });

    const parsedUrls = parseImageUrls(post.imageUrl);

    res.json({
      id: post.id,
      userId: post.userId,
      recapId: post.recapId,
      imageUrl: parsedUrls[0] || null,
      imageUrls: parsedUrls,
      caption: post.caption,
      visibility: post.visibility,
      createdAt: post.createdAt,
      user: post.user,
      recap: post.recap,
      comments: post.comments,
      reactionCounts,
      userReactions
    });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock post detail.");
      res.json({
        id: postId,
        userId: 999,
        recapId: 888,
        imageUrl: null,
        imageUrls: [],
        caption: "Crushed a backend migration! Let's lock in.",
        visibility: "everyone",
        createdAt: new Date().toISOString(),
        user: {
          id: 999,
          name: "Faheem",
          department: "CSE",
          college: "SRM KTR",
          reputationScore: 190
        },
        recap: {
          id: 888,
          sessionDuration: 45,
          tasksCompleted: 3,
          streak: 4,
          categorySnapshot: "Development",
          missionTitle: "Database Restructure",
          generatedAt: new Date().toISOString()
        },
        comments: [
          {
            id: 1,
            postId,
            userId: 101,
            text: "Nice job!",
            createdAt: new Date().toISOString(),
            user: { id: 101, name: "Rayaan", department: "CSE" }
          }
        ],
        reactionCounts: { "🔥": 3, "💀": 1, "❤️": 2, "🧠": 4 },
        userReactions: { "🔥": false, "💀": false, "❤️": false, "🧠": false }
      });
      return;
    }
    console.error("Error loading post details", error);
    res.status(500).json({ error: "Failed to load post details." });
  }
}

// POST /api/posts/:id/react
async function toggleReaction(req, res) {
  const postId = Number(req.params.id);
  const { userId, emoji } = req.body;

  if (isNaN(postId) || !userId || !emoji) {
    return res.status(400).json({ error: "postId, userId and emoji are required." });
  }

  const allowedEmojis = ["🔥", "💀", "❤️", "🧠"];
  if (!allowedEmojis.includes(emoji)) {
    return res.status(400).json({ error: `Invalid emoji. Allowed: ${allowedEmojis.join(", ")}` });
  }

  try {
    const numericUserId = Number(userId);

    // Check if user already reacted with this emoji
    const existing = await prisma.reaction.findUnique({
      where: {
        userId_postId_emoji: {
          userId: numericUserId,
          postId,
          emoji
        }
      }
    });

    if (existing) {
      // Toggle off: delete
      await prisma.reaction.delete({
        where: { id: existing.id }
      });
    } else {
      // Toggle on: create
      await prisma.reaction.create({
        data: {
          userId: numericUserId,
          postId,
          emoji
        }
      });
    }

    // Return updated reaction counts
    const reactions = await prisma.reaction.findMany({
      where: { postId }
    });

    const reactionCounts = { "🔥": 0, "💀": 0, "❤️": 0, "🧠": 0 };
    const userReactions = { "🔥": false, "💀": false, "❤️": false, "🧠": false };

    reactions.forEach(r => {
      if (reactionCounts[r.emoji] !== undefined) {
        reactionCounts[r.emoji]++;
      }
      if (r.userId === numericUserId) {
        if (userReactions[r.emoji] !== undefined) {
          userReactions[r.emoji] = true;
        }
      }
    });

    res.json({
      reactionCounts,
      userReactions
    });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock reaction counts.");
      res.json({
        reactionCounts: { "🔥": 4, "💀": 1, "❤️": 2, "🧠": 5 },
        userReactions: { "🔥": true, "💀": false, "❤️": false, "🧠": true }
      });
      return;
    }
    console.error("Error toggling reaction", error);
    res.status(500).json({ error: "Failed to update reaction." });
  }
}

// POST /api/posts/:id/comments
async function addComment(req, res) {
  const postId = Number(req.params.id);
  const { userId, text } = req.body;

  if (isNaN(postId) || !userId || !text) {
    return res.status(400).json({ error: "postId, userId and text are required." });
  }

  if (text.length > 300) {
    return res.status(400).json({ error: "Comment must be 300 characters or less." });
  }

  try {
    const numericUserId = Number(userId);

    const comment = await prisma.comment.create({
      data: {
        postId,
        userId: numericUserId,
        text
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: true
          }
        }
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning mock comment.");
      res.status(201).json({
        id: Math.floor(Math.random() * 1000) + 1000,
        postId,
        userId: Number(userId),
        text,
        createdAt: new Date().toISOString(),
        user: {
          id: Number(userId),
          name: "Rayaan Arora",
          department: "CSE"
        }
      });
      return;
    }
    console.error("Error adding comment", error);
    res.status(500).json({ error: "Failed to add comment." });
  }
}

// DELETE /api/posts/:id
async function deletePost(req, res) {
  const postId = Number(req.params.id);
  const userId = Number(req.query.userId || req.body.userId);

  if (isNaN(postId) || isNaN(userId)) {
    return res.status(400).json({ error: "postId and userId are required." });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found." });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: "You are not authorized to delete this post." });
    }

    await prisma.post.delete({
      where: { id: postId }
    });

    res.json({ message: "Post deleted successfully." });
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.warn("Database offline. Returning success mock delete.");
      res.json({ message: "Post deleted successfully." });
      return;
    }
    console.error("Error deleting post", error);
    res.status(500).json({ error: "Failed to delete post." });
  }
}

module.exports = {
  createPost,
  getPostsFeed,
  getPostDetail,
  toggleReaction,
  addComment,
  deletePost
};
