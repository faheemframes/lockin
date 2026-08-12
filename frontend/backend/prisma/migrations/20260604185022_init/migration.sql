-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100),
    "department" VARCHAR(50),
    "reputation_score" INTEGER NOT NULL DEFAULT 0,
    "college" VARCHAR(100),
    "location" VARCHAR(100),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "category" (
    "category_id" SERIAL NOT NULL,
    "category_name" VARCHAR(50) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "mission" (
    "mission_id" SERIAL NOT NULL,
    "mission_title" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "mission_time" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(100),
    "category_id" INTEGER,
    "created_by" INTEGER,

    CONSTRAINT "mission_pkey" PRIMARY KEY ("mission_id")
);

-- CreateTable
CREATE TABLE "skill" (
    "skill_id" SERIAL NOT NULL,
    "skill_name" VARCHAR(50) NOT NULL,
    "verification_source" VARCHAR(50),

    CONSTRAINT "skill_pkey" PRIMARY KEY ("skill_id")
);

-- CreateTable
CREATE TABLE "participation" (
    "participation_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "mission_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "showed_up" BOOLEAN,

    CONSTRAINT "participation_pkey" PRIMARY KEY ("participation_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "message_id" SERIAL NOT NULL,
    "mission_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "participation_user_id_mission_id_key" ON "participation"("user_id", "mission_id");

-- AddForeignKey
ALTER TABLE "mission" ADD CONSTRAINT "mission_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission" ADD CONSTRAINT "mission_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participation" ADD CONSTRAINT "participation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participation" ADD CONSTRAINT "participation_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "mission"("mission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "mission"("mission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
