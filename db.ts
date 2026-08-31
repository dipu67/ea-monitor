import { PrismaClient } from "./generated/prisma/client.js";
import { config } from "./config.js";

function isTermux() {
  return Boolean(
    process.env.TERMUX_VERSION ||
      process.env.TERMUX_PREFIX ||
      process.env.PREFIX?.includes("com.termux"),
  );
}

async function createPrisma() {
  if (isTermux()) {
    const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
    return new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: config.databaseUrl }),
    });
  }
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  return new PrismaClient({ adapter: new PrismaLibSql({ url: config.databaseUrl }) });
}

export const prisma = await createPrisma();

export async function getSettings() {
  return prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      pollIntervalSec: config.defaultPollIntervalSec,
    },
    update: {},
  });
}
