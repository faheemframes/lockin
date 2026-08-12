/**
 * Non-destructive Side Quest template seed.
 * Upserts curated LOCKIN templates without wiping users/missions.
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TEMPLATES = [
  {
    title: "Run 5 KM",
    description: "Lace up and cover 5 kilometers at your own pace. Track distance and finish strong.",
    category: "Fitness",
    categoryId: 8,
    estimatedDuration: 45,
    difficulty: "medium",
    defaultTasks: ["Warm up for 5 minutes", "Run or jog 5 KM", "Cool down and stretch", "Log your pace"],
    coverColor: "#14b8a6",
    coverImage: "linear-gradient(135deg, #0f1c1a 0%, #0d0f11 100%)"
  },
  {
    title: "30-Minute Full-Body Workout",
    description: "A focused strength circuit — no gym required. Move with intent for 30 minutes.",
    category: "Fitness",
    categoryId: 8,
    estimatedDuration: 30,
    difficulty: "easy",
    defaultTasks: ["Set a 30-minute timer", "Complete full-body circuit", "Note sets and reps", "Stretch for 5 minutes"],
    coverColor: "#14b8a6",
    coverImage: "linear-gradient(135deg, #102018 0%, #0d0f11 100%)"
  },
  {
    title: "Deep Work — 60 Minutes",
    description: "One block of uninterrupted focus. One task. Zero notifications.",
    category: "Study",
    categoryId: 9,
    estimatedDuration: 60,
    difficulty: "medium",
    defaultTasks: ["Choose one task", "Remove distractions", "Focus for 60 minutes", "Record what you accomplished"],
    coverColor: "#6366f1",
    coverImage: "linear-gradient(135deg, #12141f 0%, #0d0f11 100%)"
  },
  {
    title: "Solve 5 DSA Problems",
    description: "Pick a topic and clear five problems. Quality over speed — understand each solution.",
    category: "Study",
    categoryId: 12,
    estimatedDuration: 90,
    difficulty: "hard",
    defaultTasks: ["Pick a topic (arrays, graphs, DP…)", "Solve problem 1–2", "Solve problem 3–4", "Solve problem 5", "Review mistakes"],
    coverColor: "#eab308",
    coverImage: "linear-gradient(135deg, #1a160c 0%, #0d0f11 100%)"
  },
  {
    title: "Read 20 Pages",
    description: "Sit with a book or paper and finish twenty pages. Capture one takeaway.",
    category: "Study",
    categoryId: 13,
    estimatedDuration: 40,
    difficulty: "easy",
    defaultTasks: ["Choose what to read", "Read 20 pages", "Write one takeaway", "Bookmark where you stopped"],
    coverColor: "#a855f7",
    coverImage: "linear-gradient(135deg, #16121c 0%, #0d0f11 100%)"
  },
  {
    title: "Ship One Small Feature",
    description: "Pick something shippable today. Build it, test it, merge or deploy it.",
    category: "Building",
    categoryId: 16,
    estimatedDuration: 90,
    difficulty: "medium",
    defaultTasks: ["Define the smallest shippable slice", "Implement the feature", "Test the happy path", "Ship or open a PR"],
    coverColor: "#f43f5e",
    coverImage: "linear-gradient(135deg, #1c1014 0%, #0d0f11 100%)"
  },
  {
    title: "Build for 60 Minutes",
    description: "Open your project and make measurable progress for one focused hour.",
    category: "Building",
    categoryId: 1,
    estimatedDuration: 60,
    difficulty: "easy",
    defaultTasks: ["Open the project", "Pick one concrete goal", "Build for 60 minutes", "Commit your progress"],
    coverColor: "#3b82f6",
    coverImage: "linear-gradient(135deg, #10151c 0%, #0d0f11 100%)"
  },
  {
    title: "Fix One Thing You've Been Avoiding",
    description: "That bug, chore, or debt you keep skipping — finish it in this session.",
    category: "Building",
    categoryId: 16,
    estimatedDuration: 45,
    difficulty: "medium",
    defaultTasks: ["Name the avoided task", "Reproduce or scope it", "Fix it", "Verify it's done"],
    coverColor: "#f43f5e",
    coverImage: "linear-gradient(135deg, #1a1210 0%, #0d0f11 100%)"
  },
  {
    title: "Make Something in 60 Minutes",
    description: "Create anything — sketch, demo, draft, prototype. Ship a draft, not perfection.",
    category: "Creative",
    categoryId: 6,
    estimatedDuration: 60,
    difficulty: "easy",
    defaultTasks: ["Decide what to make", "Set a 60-minute timer", "Create a first draft", "Save and share if ready"],
    coverColor: "#ec4899",
    coverImage: "linear-gradient(135deg, #1c1018 0%, #0d0f11 100%)"
  },
  {
    title: "Edit One Video",
    description: "Take one clip or draft and cut it into something watchable.",
    category: "Creative",
    categoryId: 7,
    estimatedDuration: 60,
    difficulty: "medium",
    defaultTasks: ["Import footage", "Cut the rough edit", "Add basic audio/text if needed", "Export a draft"],
    coverColor: "#f97316",
    coverImage: "linear-gradient(135deg, #1c140e 0%, #0d0f11 100%)"
  },
  {
    title: "Write 500 Words",
    description: "Fill a page. Journal, essay, script, or docs — count the words at the end.",
    category: "Creative",
    categoryId: 7,
    estimatedDuration: 45,
    difficulty: "easy",
    defaultTasks: ["Pick a topic or prompt", "Write without editing for 25 min", "Reach 500 words", "Do one light pass"],
    coverColor: "#f97316",
    coverImage: "linear-gradient(135deg, #1a120e 0%, #0d0f11 100%)"
  },
  {
    title: "Clean Your Workspace",
    description: "Clear the desk, close the tabs that don't matter, reset your environment.",
    category: "Life",
    categoryId: 19,
    estimatedDuration: 25,
    difficulty: "easy",
    defaultTasks: ["Clear physical desk", "Close unused tabs/apps", "Tidy digital desktop", "Set up for next focus block"],
    coverColor: "#a1a1aa",
    coverImage: "linear-gradient(135deg, #141414 0%, #0d0f11 100%)"
  },
  {
    title: "Take a 30-Minute Walk",
    description: "Leave the screen. Walk for thirty minutes — no scrolling required.",
    category: "Life",
    categoryId: 8,
    estimatedDuration: 30,
    difficulty: "easy",
    defaultTasks: ["Put the phone on focus mode", "Walk for 30 minutes", "Note how you feel after"],
    coverColor: "#14b8a6",
    coverImage: "linear-gradient(135deg, #101816 0%, #0d0f11 100%)"
  },
  {
    title: "Call Someone You've Been Putting Off",
    description: "That message or call you owe someone — make it happen in this session.",
    category: "Social",
    categoryId: 17,
    estimatedDuration: 20,
    difficulty: "easy",
    defaultTasks: ["Pick who to call", "Make the call or send a real voice note", "Follow up if needed"],
    coverColor: "#22c55e",
    coverImage: "linear-gradient(135deg, #101814 0%, #0d0f11 100%)"
  }
];

async function main() {
  console.log("[DB] Seeding Side Quest templates (upsert by title)...\n");

  for (const template of TEMPLATES) {
    const existing = await prisma.missionTemplate.findFirst({
      where: { title: template.title }
    });

    if (existing) {
      await prisma.missionTemplate.update({
        where: { id: existing.id },
        data: { ...template, isActive: true }
      });
      console.log(`  updated: ${template.title}`);
    } else {
      await prisma.missionTemplate.create({
        data: { ...template, isActive: true }
      });
      console.log(`  created: ${template.title}`);
    }
  }

  const count = await prisma.missionTemplate.count({ where: { isActive: true } });
  console.log(`\n[OK] ${count} active Side Quest templates ready.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
