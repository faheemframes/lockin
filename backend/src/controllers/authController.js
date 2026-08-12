const prisma = require("../config/db");
const { isDbUnavailable } = require("../utils/dbFallback");

async function resolveCollegeByEmail(email) {
  const domain = email.trim().toLowerCase().split("@")[1];
  let college = await prisma.college.findFirst({
    where: { emailDomain: domain },
  });

  if (!college) {
    const parts = domain.split(".");
    if (parts.length > 2) {
      const baseDomain = parts.slice(1).join(".");
      college = await prisma.college.findFirst({
        where: { emailDomain: baseDomain },
      });
    }
  }

  return college;
}

function isProfileIncomplete(user) {
  if (!user) return true;
  return !user.department || String(user.department).trim().length < 2;
}

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: user.emailVerified,
    college: user.college,
    college_id: user.email,
    department: user.department,
    reputation_score: user.reputationScore,
    bio: user.bio,
    instagram: user.instagram,
    github: user.github,
    interests: user.interests,
    campus_id: user.collegeId,
    campus_name: user.collegeRef?.shortName || user.college || "",
    verified_at: user.verifiedAt,
    incomplete: isProfileIncomplete(user)
  };
}

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

  try {
    const college = await resolveCollegeByEmail(email);

    if (!college) {
      return res.status(400).json({
        error: "Only student email addresses from supported colleges are allowed.",
      });
    }

    res.json({
      success: true,
      college: {
        id: college.id,
        name: college.shortName,
        full_name: college.collegeName,
        college_type: college.collegeType,
      },
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

    const college = await resolveCollegeByEmail(email);

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
      user: serializeUser(user)
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

  if (!req.user || isProfileIncomplete(req.user)) {
    return res.json({
      incomplete: true,
      id: req.user?.id || null,
      email: req.supabaseUser.email,
      name: req.user?.name || req.supabaseUser.email.split("@")[0],
      college: req.user?.college || null,
      department: req.user?.department || null
    });
  }

  res.json(serializeUser(req.user));
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
  logout,
};
