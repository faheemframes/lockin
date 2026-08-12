const prisma = require("../config/db");
const { isDbUnavailable } = require("../utils/dbFallback");

/**
 * GET /api/colleges
 * List all colleges, optionally filtered by type
 */
async function listColleges(req, res) {
  const { type, state } = req.query;

  try {
    const where = {};
    if (type) where.collegeType = type;
    if (state) where.state = { contains: state, mode: "insensitive" };

    const colleges = await prisma.college.findMany({
      where,
      orderBy: [{ collegeType: "asc" }, { collegeName: "asc" }]
    });

    res.json(
      colleges.map((c) => ({
        id: c.id,
        name: c.shortName,
        full_name: c.collegeName,
        college_type: c.collegeType,
        city: c.city,
        state: c.state,
        location: `${c.city}, ${c.state}`,
        email_domain: c.emailDomain
      }))
    );
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json([]);
  }
}

/**
 * GET /api/colleges/search?q=srm
 * Fuzzy search colleges by name, short name, city, or state
 */
async function searchColleges(req, res) {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: "Search query must be at least 2 characters." });
  }

  try {
    const query = q.trim();

    const colleges = await prisma.college.findMany({
      where: {
        OR: [
          { collegeName: { contains: query, mode: "insensitive" } },
          { shortName: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
          { state: { contains: query, mode: "insensitive" } },
          { emailDomain: { contains: query, mode: "insensitive" } }
        ]
      },
      orderBy: [{ collegeType: "asc" }, { shortName: "asc" }],
      take: 50
    });

    res.json(
      colleges.map((c) => ({
        id: c.id,
        name: c.shortName,
        full_name: c.collegeName,
        college_type: c.collegeType,
        city: c.city,
        state: c.state,
        location: `${c.city}, ${c.state}`,
        email_domain: c.emailDomain
      }))
    );
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json([]);
  }
}

/**
 * GET /api/colleges/detect?email=faheem@srmist.edu.in
 * Auto-detect college from email domain
 */
async function detectCollege(req, res) {
  const { email } = req.query;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email address is required." });
  }

  const domain = email.split("@")[1].toLowerCase();

  try {
    // Try exact match first
    let college = await prisma.college.findFirst({
      where: { emailDomain: domain }
    });

    // If no exact match, try matching by stripping subdomains
    // e.g., "student.iitb.ac.in" → "iitb.ac.in"
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
      return res.json({
        detected: false,
        domain,
        college: null,
        message: "College not found for this email domain. You can still register manually."
      });
    }

    res.json({
      detected: true,
      domain,
      college: {
        id: college.id,
        name: college.shortName,
        full_name: college.collegeName,
        college_type: college.collegeType,
        city: college.city,
        state: college.state,
        email_domain: college.emailDomain
      }
    });
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json({ detected: false, domain, college: null });
  }
}

/**
 * GET /api/colleges/types
 * Get all distinct college types
 */
async function getCollegeTypes(req, res) {
  try {
    const types = await prisma.college.findMany({
      select: { collegeType: true },
      distinct: ["collegeType"],
      orderBy: { collegeType: "asc" }
    });
    res.json(types.map((t) => t.collegeType));
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    res.json([]);
  }
}

module.exports = {
  listColleges,
  searchColleges,
  detectCollege,
  getCollegeTypes
};
