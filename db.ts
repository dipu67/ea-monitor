import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./generated/prisma/client.js";
import { config } from "./config.js";

const adapter = new PrismaLibSql({ url: config.databaseUrl });
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
