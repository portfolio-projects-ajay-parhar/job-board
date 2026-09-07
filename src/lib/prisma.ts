import { PrismaClient } from "@prisma/client";

// Prisma Client singleton — avoids exhausting Postgres connections during
// Next.js dev hot-reload by caching the instance on `globalThis`.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
