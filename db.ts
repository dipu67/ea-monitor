import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client.js";
import { config } from "./config.js";

const adapter = new PrismaBetterSqlite3({ url: config.databaseUrl });
export const prisma = new PrismaClient({ adapter });

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
