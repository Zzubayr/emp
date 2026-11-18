import { PrismaClient } from "@prisma/client";
import { runtimeDatabaseUrl } from "./db-url";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ datasourceUrl: runtimeDatabaseUrl() });
if (process.env.NODE_ENV !== "production") g.prisma = db;
