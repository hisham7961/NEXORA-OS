-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaEnabledAt" TIMESTAMP(3),
ADD COLUMN     "mfaRecoveryJson" TEXT,
ADD COLUMN     "mfaSecret" TEXT;
