/*
  Warnings:

  - You are about to drop the column `campus_id` on the `mission` table. All the data in the column will be lost.
  - You are about to drop the column `campus_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `campus` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[category_name]` on the table `category` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "mission" DROP CONSTRAINT "mission_campus_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_campus_id_fkey";

-- AlterTable
ALTER TABLE "category" ADD COLUMN     "color_hex" VARCHAR(7),
ADD COLUMN     "emoji" VARCHAR(10);

-- AlterTable
ALTER TABLE "mission" DROP COLUMN "campus_id",
ADD COLUMN     "college_id" INTEGER,
ADD COLUMN     "mission_type" VARCHAR(20) NOT NULL DEFAULT 'group',
ALTER COLUMN "mission_time" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "campus_id",
ADD COLUMN     "college_id" INTEGER,
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verified_at" TIMESTAMP(3);

-- DropTable
DROP TABLE "campus";

-- CreateTable
CREATE TABLE "college" (
    "college_id" SERIAL NOT NULL,
    "college_name" VARCHAR(200) NOT NULL,
    "short_name" VARCHAR(100) NOT NULL,
    "college_type" VARCHAR(50) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "country" VARCHAR(50) NOT NULL DEFAULT 'India',
    "official_domain" VARCHAR(100),
    "email_domain" VARCHAR(100),

    CONSTRAINT "college_pkey" PRIMARY KEY ("college_id")
);

-- CreateTable
CREATE TABLE "user_interest" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "task_id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "mission_id" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "session_recap" (
    "recap_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "mission_id" INTEGER,
    "mission_title" TEXT,
    "category_id" INTEGER,
    "category_snapshot" TEXT,
    "session_duration" INTEGER NOT NULL,
    "tasks_completed" INTEGER NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "mission_rank" INTEGER,
    "card_version" INTEGER NOT NULL DEFAULT 1,
    "share_id" TEXT NOT NULL,
    "recap_type" TEXT NOT NULL,
    "achievements" JSONB,
    "participant_count" INTEGER,
    "ai_insight" TEXT,
    "reflection_text" TEXT,
    "lessons_learned" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_recap_pkey" PRIMARY KEY ("recap_id")
);

-- CreateTable
CREATE TABLE "daily_activity" (
    "activity_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "missions_completed" INTEGER NOT NULL DEFAULT 0,
    "focus_minutes" INTEGER NOT NULL DEFAULT 0,
    "tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "aura_earned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_activity_pkey" PRIMARY KEY ("activity_id")
);

-- CreateTable
CREATE TABLE "follow" (
    "follow_id" SERIAL NOT NULL,
    "follower_id" INTEGER NOT NULL,
    "following_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_pkey" PRIMARY KEY ("follow_id")
);

-- CreateTable
CREATE TABLE "feed_item" (
    "feed_item_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "recap_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_item_pkey" PRIMARY KEY ("feed_item_id")
);

-- CreateTable
CREATE TABLE "otp" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "college_email_domain_idx" ON "college"("email_domain");

-- CreateIndex
CREATE INDEX "college_college_type_idx" ON "college"("college_type");

-- CreateIndex
CREATE UNIQUE INDEX "user_interest_user_id_category_id_key" ON "user_interest"("user_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_recap_share_id_key" ON "session_recap"("share_id");

-- CreateIndex
CREATE INDEX "session_recap_user_id_generated_at_idx" ON "session_recap"("user_id", "generated_at");

-- CreateIndex
CREATE INDEX "session_recap_user_id_category_snapshot_generated_at_idx" ON "session_recap"("user_id", "category_snapshot", "generated_at");

-- CreateIndex
CREATE INDEX "session_recap_share_id_idx" ON "session_recap"("share_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_activity_user_id_date_key" ON "daily_activity"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "follow_follower_id_following_id_key" ON "follow"("follower_id", "following_id");

-- CreateIndex
CREATE INDEX "feed_item_user_id_created_at_idx" ON "feed_item"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "otp_email_used_idx" ON "otp"("email", "used");

-- CreateIndex
CREATE UNIQUE INDEX "category_category_name_key" ON "category"("category_name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "college"("college_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission" ADD CONSTRAINT "mission_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "college"("college_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "mission"("mission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_recap" ADD CONSTRAINT "session_recap_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_recap" ADD CONSTRAINT "session_recap_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "mission"("mission_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_item" ADD CONSTRAINT "feed_item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
