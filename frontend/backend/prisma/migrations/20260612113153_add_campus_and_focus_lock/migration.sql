-- AlterTable
ALTER TABLE "mission" ADD COLUMN     "campus_id" INTEGER,
ADD COLUMN     "focus_duration" INTEGER NOT NULL DEFAULT 25;

-- AlterTable
ALTER TABLE "participation" ADD COLUMN     "creator_vibe_rating" VARCHAR(10),
ADD COLUMN     "participant_vibe_rating" VARCHAR(10),
ADD COLUMN     "work_duration" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "work_started_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" VARCHAR(150),
ADD COLUMN     "campus_id" INTEGER,
ADD COLUMN     "github" VARCHAR(50),
ADD COLUMN     "instagram" VARCHAR(50),
ADD COLUMN     "interests" TEXT;

-- CreateTable
CREATE TABLE "campus" (
    "campus_id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "location" VARCHAR(100),

    CONSTRAINT "campus_pkey" PRIMARY KEY ("campus_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campus_name_key" ON "campus"("name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("campus_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission" ADD CONSTRAINT "mission_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("campus_id") ON DELETE SET NULL ON UPDATE CASCADE;
