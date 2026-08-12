const prisma = require("../config/db");
const { isDbUnavailable } = require("../utils/dbFallback");

/**
 * GET /api/auth/check-domain
 * Query: { email: string }
 * Checks if email domain is allowed on this campus app.
 */
async function checkDomain(req, res) {
  const { email } = req.query;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid student email is required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split("@")[1];

  try {
    let college = await prisma.college.findFirst({
      where: { emailDomain: domain }
    });

    if (!college) {
      const parts = domain.split(".");
      if (parts.length > 2) {
        const baseDomain = parts.slice(1).join(".");
        college = await prisma.college.findFirst({
          where: { emailDomain: baseDomain }
        });
      }
    }

    if (!college) {
      return res.status(400).json({
        error: "Only student email addresses from supported colleges are allowed."
      });
    }

    res.json({
      success: true,
      college: {
        id: college.id,
        name: college.shortName,
        full_name: college.collegeName,
        college_type: college.collegeType
      }
    });
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.status(500).json({ error: "Failed to check domain." });
  }
}

/**
 * POST /api/auth/profile
 * Syncs the verified Supabase user profile in our database.
 * Creates a skeleton profile for first-time signups.
 */
async function syncProfile(req, res) {
  if (!req.supabaseUser) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  const email = req.supabaseUser.email;
  const supabaseId = req.supabaseUser.id;

  try {
    // Find existing user by supabaseId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { supabaseId: supabaseId },
          { email: email }
        ]
      }
    });

    const domain = email.trim().toLowerCase().split("@")[1];
    let college = await prisma.college.findFirst({
      where: { emailDomain: domain }
    });

    if (!college) {
      const parts = domain.split(".");
      if (parts.length > 2) {
        const baseDomain = parts.slice(1).join(".");
        college = await prisma.college.findFirst({
          where: { emailDomain: baseDomain }
        });
      }
    }

    if (!user) {
      // Create new skeleton database profile
      user = await prisma.user.create({
        data: {
          supabaseId: supabaseId,
          name: email.split("@")[0],
          email: email,
          emailVerified: true,
          verifiedAt: new Date(),
          college: college ? college.shortName : null,
          collegeId: college ? college.id : null,
          reputationScore: 100
        }
      });
    } else if (!user.supabaseId) {
      // Link pre-existing database row to the new Supabase Auth identity
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          supabaseId: supabaseId,
          emailVerified: true,
          verifiedAt: new Date()
        }
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified: user.emailVerified,
        college: user.college,
        department: user.department,
        reputation_score: user.reputationScore,
        bio: user.bio,
        instagram: user.instagram,
        github: user.github,
        interests: user.interests
      }
    });
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.status(500).json({ error: "Failed to synchronize profile." });
  }
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user details.
 */
async function getMe(req, res) {
  if (!req.supabaseUser) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  if (!req.user) {
    return res.json({
      incomplete: true,
      email: req.supabaseUser.email,
      name: req.supabaseUser.email.split("@")[0]
    });
  }

  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    email_verified: req.user.emailVerified,
    college: req.user.college,
    college_id: req.user.email, // Legacy mapping
    department: req.user.department,
    reputation_score: req.user.reputationScore,
    bio: req.user.bio,
    instagram: req.user.instagram,
    github: req.user.github,
    interests: req.user.interests,
    campus_id: req.user.collegeId,
    campus_name: req.user.collegeRef?.shortName || "",
    verified_at: req.user.verifiedAt
  });
}

/**
 * POST /api/auth/logout
 * Clears session.
 */
async function logout(req, res) {
  res.json({ success: true, message: "Logged out." });
}

module.exports = {
  checkDomain,
  syncProfile,
  getMe,
  logout
};
