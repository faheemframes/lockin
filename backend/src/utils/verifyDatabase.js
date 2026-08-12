const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("=== Database Verification Report ===\n");
  
  const models = [
    { name: "User", client: prisma.user },
    { name: "College", client: prisma.college },
    { name: "Category", client: prisma.category },
    { name: "UserInterest", client: prisma.userInterest },
    { name: "Mission", client: prisma.mission },
    { name: "Task", client: prisma.task },
    { name: "Skill", client: prisma.skill },
    { name: "Participation", client: prisma.participation },
    { name: "Message", client: prisma.message },
    { name: "SessionRecap", client: prisma.sessionRecap },
    { name: "DailyActivity", client: prisma.dailyActivity },
    { name: "Follow", client: prisma.follow },
    { name: "FeedItem", client: prisma.feedItem },
    { name: "Otp", client: prisma.otp },
    { name: "Post", client: prisma.post },
    { name: "Comment", client: prisma.comment },
    { name: "Reaction", client: prisma.reaction }
  ];

  let successCount = 0;

  for (const model of models) {
    try {
      const count = await model.client.count();
      console.log(`✓ [OK] Table: ${model.name.padEnd(20)} | Rows: ${count}`);
      successCount++;
    } catch (err) {
      console.log(`✗ [FAIL] Table: ${model.name.padEnd(18)} | Error: ${err.message}`);
    }
  }

  console.log(`\nVerification finished: ${successCount}/${models.length} tables verified.`);
  
  if (successCount === models.length) {
    console.log("\n★ SUCCESS: All database tables are present and verified in Supabase!");
  } else {
    console.log("\n⚠ WARNING: Some tables failed verification. Check the errors above.");
  }
}

main()
  .catch((err) => {
    console.error("Fatal error during database verification:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
