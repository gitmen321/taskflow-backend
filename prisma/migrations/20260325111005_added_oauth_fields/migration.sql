-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'LOCAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "providerId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;
