-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "attendees" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "minAttendees" INTEGER;
