import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { __joblioPrisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Serverless functions open many short-lived connections; Neon's pooled
  // endpoint (host contains "-pooler") absorbs them. Direct endpoints run out.
  if (process.env.VERCEL && /\.neon\.tech/.test(connectionString) && !/-pooler\./.test(connectionString)) {
    console.warn("[db] DATABASE_URL uses a direct Neon endpoint. Use the pooled one (host with -pooler) on Vercel.");
  }
  const adapter = new PrismaPg({ connectionString, max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// One client per process; reused across hot reloads in development.
export const db = globalForPrisma.__joblioPrisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.__joblioPrisma = db;

export type { Prisma } from "@/generated/prisma/client";
