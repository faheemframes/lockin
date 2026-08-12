const { PrismaClient } = require("@prisma/client");
const path = require("path");
const prisma = new PrismaClient();

async function main() {
  console.log("[DB] Seeding database...\n");

  // ─── Clean DB ──────────────────────────────────────────────────────
  console.log("  Cleaning existing data...");
  await prisma.userInterest.deleteMany({});
  await prisma.otp.deleteMany({});
  await prisma.feedItem.deleteMany({});
  await prisma.dailyActivity.deleteMany({});
  await prisma.follow.deleteMany({});
  await prisma.sessionRecap.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.participation.deleteMany({});
  await prisma.mission.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.college.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.skill.deleteMany({});

  // ─── Seed Colleges from JSON ───────────────────────────────────────
  console.log("  Loading colleges from colleges.json...");
  let colleges;
  try {
    colleges = require(path.resolve(__dirname, "../src/data/colleges.json"));
    console.log(`  Found ${colleges.length} colleges in database file.`);
  } catch (err) {
    console.warn("  [WARN] colleges.json not found, seeding with minimal college data.");
    colleges = [
      { college_name: "SRM Institute of Science and Technology", short_name: "SRM IST KTR", college_type: "Private Engineering", city: "Kattankulathur", state: "Tamil Nadu", country: "India", official_domain: "srmist.edu.in", email_domain: "srmist.edu.in" },
      { college_name: "SRM IST Ramapuram", short_name: "SRM IST Ramapuram", college_type: "Private Engineering", city: "Chennai", state: "Tamil Nadu", country: "India", official_domain: "srmist.edu.in", email_domain: "srmist.edu.in" },
      { college_name: "SRM IST Vadapalani", short_name: "SRM IST Vadapalani", college_type: "Private Engineering", city: "Chennai", state: "Tamil Nadu", country: "India", official_domain: "srmist.edu.in", email_domain: "srmist.edu.in" },
      { college_name: "Indian Institute of Technology Madras", short_name: "IIT Madras", college_type: "IIT", city: "Chennai", state: "Tamil Nadu", country: "India", official_domain: "iitm.ac.in", email_domain: "smail.iitm.ac.in" },
      { college_name: "Indian Institute of Technology Bombay", short_name: "IIT Bombay", college_type: "IIT", city: "Mumbai", state: "Maharashtra", country: "India", official_domain: "iitb.ac.in", email_domain: "iitb.ac.in" },
      { college_name: "Indian Institute of Technology Delhi", short_name: "IIT Delhi", college_type: "IIT", city: "New Delhi", state: "Delhi", country: "India", official_domain: "iitd.ac.in", email_domain: "iitd.ac.in" },
      { college_name: "VIT University Vellore", short_name: "VIT Vellore", college_type: "Private Engineering", city: "Vellore", state: "Tamil Nadu", country: "India", official_domain: "vit.ac.in", email_domain: "vit.ac.in" },
      { college_name: "BITS Pilani", short_name: "BITS Pilani", college_type: "BITS", city: "Pilani", state: "Rajasthan", country: "India", official_domain: "bits-pilani.ac.in", email_domain: "pilani.bits-pilani.ac.in" },
      { college_name: "National Institute of Technology Tiruchirappalli", short_name: "NIT Trichy", college_type: "NIT", city: "Tiruchirappalli", state: "Tamil Nadu", country: "India", official_domain: "nitt.edu", email_domain: "nitt.edu" },
      { college_name: "Taylor's University", short_name: "Taylor's University", college_type: "Private University", city: "Subang Jaya", state: "Selangor", country: "Malaysia", official_domain: "taylors.edu.my", email_domain: "sd.taylors.edu.my" }
    ];
  }

  // Batch insert colleges
  for (let i = 0; i < colleges.length; i += 50) {
    const batch = colleges.slice(i, i + 50).map((c) => ({
      collegeName: c.college_name,
      shortName: c.short_name,
      collegeType: c.college_type,
      city: c.city,
      state: c.state,
      country: c.country || "India",
      officialDomain: c.official_domain || null,
      emailDomain: c.email_domain || null
    }));
    await prisma.college.createMany({ data: batch });
  }
  console.log(`  [OK] Seeded ${colleges.length} colleges.\n`);

  // ─── Seed Categories (19 expanded) ─────────────────────────────────
  console.log("  Seeding 19 categories...");
  const categoriesData = [
    { id: 1,  categoryName: "Coding",                   emoji: null, colorHex: "#3b82f6" },
    { id: 2,  categoryName: "AI",                       emoji: null, colorHex: "#8b5cf6" },
    { id: 3,  categoryName: "Startups",                 emoji: null, colorHex: "#f59e0b" },
    { id: 4,  categoryName: "Hackathons",               emoji: null, colorHex: "#ef4444" },
    { id: 5,  categoryName: "Open Source",              emoji: null, colorHex: "#10b981" },
    { id: 6,  categoryName: "Design",                   emoji: null, colorHex: "#ec4899" },
    { id: 7,  categoryName: "Content Creation",         emoji: null, colorHex: "#f97316" },
    { id: 8,  categoryName: "Fitness",                  emoji: null, colorHex: "#14b8a6" },
    { id: 9,  categoryName: "Study Sessions",           emoji: null, colorHex: "#6366f1" },
    { id: 10, categoryName: "Research",                 emoji: null, colorHex: "#0ea5e9" },
    { id: 11, categoryName: "Placements",               emoji: null, colorHex: "#e11d48" },
    { id: 12, categoryName: "Competitive Programming",  emoji: null, colorHex: "#eab308" },
    { id: 13, categoryName: "Reading",                  emoji: null, colorHex: "#a855f7" },
    { id: 14, categoryName: "Languages",                emoji: null, colorHex: "#06b6d4" },
    { id: 15, categoryName: "Career",                   emoji: null, colorHex: "#64748b" },
    { id: 16, categoryName: "Projects",                 emoji: null, colorHex: "#f43f5e" },
    { id: 17, categoryName: "Networking",               emoji: null, colorHex: "#22c55e" },
    { id: 18, categoryName: "Events",                   emoji: null, colorHex: "#d946ef" },
    { id: 19, categoryName: "Other",                    emoji: null, colorHex: "#a1a1aa" }
  ];

  await prisma.category.createMany({ data: categoriesData });
  console.log("  [OK] Seeded 19 categories.\n");

  // ─── Seed Skills ───────────────────────────────────────────────────
  await prisma.skill.createMany({
    data: [
      { id: 1, skillName: "JavaScript", verificationSource: "GitHub" },
      { id: 2, skillName: "React", verificationSource: "Project Portfolio" },
      { id: 3, skillName: "MySQL", verificationSource: "DBMS Lab" },
      { id: 4, skillName: "Node.js", verificationSource: "GitHub" },
      { id: 5, skillName: "UI Design", verificationSource: "Portfolio" }
    ]
  });

  // ─── Find SRM KTR college for seed users ───────────────────────────
  const srmKtr = await prisma.college.findFirst({
    where: {
      OR: [
        { shortName: { contains: "SRM IST KTR", mode: "insensitive" } },
        { shortName: { contains: "SRM IST, Kattankulathur", mode: "insensitive" } },
        { emailDomain: "srmist.edu.in" }
      ]
    }
  });
  const srmCollegeId = srmKtr ? srmKtr.id : null;
  console.log(`  SRM KTR college ID: ${srmCollegeId || "not found (using null)"}`);

  // ─── Seed Users ────────────────────────────────────────────────────
  console.log("  Seeding 10 demo users...");
  await prisma.user.createMany({
    data: [
      { id: 101, name: "Faheem", email: "faheem@srmist.edu.in", emailVerified: true, verifiedAt: new Date(), department: "Networking and Communications", reputationScore: 80, college: srmKtr ? srmKtr.shortName : "SRM IST KTR", location: "SRM KTR Library", collegeId: srmCollegeId, bio: "Building LOCKIN app. Let's meet up and execute.", instagram: "@faheem_comm", github: "faheem-git", interests: "Coding, Design, Other" },
      { id: 102, name: "Rayaan", email: "rayaan@srmist.edu.in", emailVerified: true, verifiedAt: new Date(), department: "Networking and Communications", reputationScore: 90, college: srmKtr ? srmKtr.shortName : "SRM IST KTR", location: "SRM KTR Tech Park", collegeId: srmCollegeId, bio: "Designing runways. Zero chatter, pure focus.", instagram: "@rayaan_arora", github: "rayaan-git", interests: "Coding, Design" },
      { id: 103, name: "Aarav Mehta", email: "aarav@srmist.edu.in", emailVerified: true, verifiedAt: new Date(), department: "Computer Science Engineering", reputationScore: 40, college: srmKtr ? srmKtr.shortName : "SRM IST KTR", location: "SRM KTR Main Campus", collegeId: srmCollegeId, bio: "Algorithms enthusiast.", instagram: "@aarav_mehta", github: "aarav-codes", interests: "Coding, Study Sessions" },
      { id: 104, name: "Maya Rao", email: "maya@srmist.edu.in", emailVerified: true, verifiedAt: new Date(), department: "Information Technology", reputationScore: 55, college: srmKtr ? srmKtr.shortName : "SRM IST KTR", location: "SRM KTR Library", collegeId: srmCollegeId, bio: "Full stack builder.", instagram: "@maya_builds", github: "maya-rao", interests: "Coding, Design" },
      { id: 105, name: "Kabir Sethi", email: "kabir@srmist.edu.in", emailVerified: true, verifiedAt: new Date(), department: "Computer Science Engineering", reputationScore: 15, college: srmKtr ? srmKtr.shortName : "SRM IST KTR", location: "SRM KTR Hostel A", collegeId: srmCollegeId, bio: "Gamer & Developer.", instagram: "@kabir_sethi", github: "kabir-git", interests: "Coding, Hackathons" },
      { id: 106, name: "Ira Thomas", email: "ira@srmist.edu.in", emailVerified: true, verifiedAt: new Date(), department: "Electronics and Communication", reputationScore: 25, college: srmKtr ? srmKtr.shortName : "SRM IST KTR", location: "SRM KTR Innovation Centre", collegeId: srmCollegeId, bio: "IoT research lead.", instagram: "@ira_thomas", github: "ira-iot", interests: "Coding, Research" },
      { id: 107, name: "Dev Nair", email: "dev@srmist.edu.in", emailVerified: true, verifiedAt: new Date(), department: "Computer Science Engineering", reputationScore: 70, college: srmKtr ? srmKtr.shortName : "SRM IST KTR", location: "SRM KTR Sports Complex", collegeId: srmCollegeId, bio: "Athlete & Hacker.", instagram: "@dev_hacks", github: "dev-nair", interests: "Fitness, Coding" },
      { id: 108, name: "Nisha Khan", email: "nisha@srmist.edu.in", emailVerified: true, verifiedAt: new Date(), department: "Data Science", reputationScore: 80, college: srmKtr ? srmKtr.shortName : "SRM IST KTR", location: "SRM KTR Cafe Court", collegeId: srmCollegeId, bio: "Analyzing vibe patterns.", instagram: "@nisha_khan", github: "nisha-data", interests: "Coding, AI" },
      { id: 109, name: "Rohan Das", email: "rohan@srmist.edu.in", emailVerified: true, verifiedAt: new Date(), department: "Artificial Intelligence", reputationScore: 35, college: srmKtr ? srmKtr.shortName : "SRM IST KTR", location: "SRM KTR Seminar Hall", collegeId: srmCollegeId, bio: "Deep learning builder.", instagram: "@rohan_das", github: "rohan-ai", interests: "Coding, AI, Research" },
      { id: 110, name: "Tara Iyer", email: "tara@srmist.edu.in", emailVerified: true, verifiedAt: new Date(), department: "Data Science", reputationScore: 45, college: srmKtr ? srmKtr.shortName : "SRM IST KTR", location: "SRM KTR Library", collegeId: srmCollegeId, bio: "Clean UI enthusiast.", instagram: "@tara_iyer", github: "tara-design", interests: "Design, Study Sessions" }
    ]
  });
  console.log("  [OK] Seeded 10 demo users.\n");

  // ─── Seed User Interests (many-to-many) ────────────────────────────
  console.log("  Seeding user interests...");
  const interestsMap = {
    101: [1, 6, 19],         // Coding, Design, Other
    102: [1, 6],             // Coding, Design
    103: [1, 9],             // Coding, Study Sessions
    104: [1, 6],             // Coding, Design
    105: [1, 4],             // Coding, Hackathons
    106: [1, 10],            // Coding, Research
    107: [8, 1],             // Fitness, Coding
    108: [1, 2],             // Coding, AI
    109: [1, 2, 10],         // Coding, AI, Research
    110: [6, 9]              // Design, Study Sessions
  };

  const interestData = [];
  for (const [userId, categoryIds] of Object.entries(interestsMap)) {
    for (const categoryId of categoryIds) {
      interestData.push({ userId: Number(userId), categoryId });
    }
  }
  await prisma.userInterest.createMany({ data: interestData });
  console.log("  [OK] Seeded user interests.\n");

  // ─── Seed Missions ─────────────────────────────────────────────────
  const now = new Date();
  const addHours = (date, h) => {
    const d = new Date(date);
    d.setTime(d.getTime() + h * 60 * 60 * 1000);
    return d;
  };

  console.log("  Seeding 10 demo missions...");
  await prisma.mission.createMany({
    data: [
      { id: 201, title: "Hackathon Grind", description: "All-night coding session to build the MVP. Bring caffeine.", datetime: addHours(now, 4), location: "SRM KTR Library", categoryId: 1, createdBy: 101, collegeId: srmCollegeId, focusDuration: 45, verificationCode: "2011" },
      { id: 202, title: "LeetCode Lock-In", description: "Solving 5 hard/medium problems on arrays and graphs.", datetime: addHours(now, 7), location: "SRM KTR Tech Park", categoryId: 12, createdBy: 102, collegeId: srmCollegeId, focusDuration: 25, verificationCode: "2022" },
      { id: 203, title: "API Battle Test", description: "Load testing express endpoints and optimizing performance.", datetime: addHours(now, 24), location: "SRM KTR Computer Lab 2", categoryId: 1, createdBy: 103, collegeId: srmCollegeId, focusDuration: 60, verificationCode: "2033" },
      { id: 204, title: "Pitch Deck Build", description: "Design pitch slides and polish the demo script.", datetime: addHours(now, 24), location: "SRM KTR Seminar Hall", categoryId: 3, createdBy: 104, collegeId: srmCollegeId, focusDuration: 15, verificationCode: "2044" },
      { id: 205, title: "Database Schema Jam", description: "Designing optimal relational tables and indexes.", datetime: addHours(now, 48), location: "SRM KTR DBMS Lab", categoryId: 1, createdBy: 105, collegeId: srmCollegeId, focusDuration: 25, verificationCode: "2055" },
      { id: 206, title: "Open Source Fix Run", description: "Squashing open bugs in our target repo. Let's contribute.", datetime: addHours(now, 48), location: "SRM KTR Innovation Centre", categoryId: 5, createdBy: 106, collegeId: srmCollegeId, focusDuration: 25, verificationCode: "2066" },
      { id: 207, title: "DSA Mock Duel", description: "1v1 mock interview sessions on tree traversal.", datetime: addHours(now, 72), location: "SRM KTR Block C", categoryId: 12, createdBy: 107, collegeId: srmCollegeId, focusDuration: 25, verificationCode: "2077" },
      { id: 208, title: "Frontend Polish Night", description: "Adding Framer Motion micro-animations to improve UI feel.", datetime: addHours(now, 72), location: "SRM KTR Design Studio", categoryId: 6, createdBy: 108, collegeId: srmCollegeId, focusDuration: 25, verificationCode: "2088" },
      { id: 209, title: "AI Paper Reading Club", description: "Reviewing latest transformer architecture papers together.", datetime: addHours(now, 96), location: "SRM KTR Networking Lab", categoryId: 2, createdBy: 109, collegeId: srmCollegeId, focusDuration: 25, verificationCode: "2099" },
      { id: 210, title: "Final Demo Rehearsal", description: "Simulating public presentation and timing of slides.", datetime: addHours(now, 120), location: "SRM KTR Auditorium Lobby", categoryId: 18, createdBy: 110, collegeId: srmCollegeId, focusDuration: 25, verificationCode: "2100" }
    ]
  });
  console.log("  [OK] Seeded 10 demo missions.\n");

  // ─── Seed Participations ───────────────────────────────────────────
  await prisma.participation.createMany({
    data: [
      { id: 301, userId: 102, missionId: 201, status: "Completed", showedUp: true },
      { id: 302, userId: 101, missionId: 202, status: "Accepted", showedUp: null },
      { id: 303, userId: 107, missionId: 203, status: "Completed", showedUp: true },
      { id: 304, userId: 108, missionId: 204, status: "Missed", showedUp: false }
    ]
  });

  // ─── Seed Messages ─────────────────────────────────────────────────
  await prisma.message.createMany({
    data: [
      { id: 1, missionId: 201, senderId: 102, message: "Locked in. I will bring the DBMS report queries." },
      { id: 2, missionId: 202, senderId: 101, message: "I am taking arrays and graphs first." }
    ]
  });

  console.log("[OK] Database seeded successfully!\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
