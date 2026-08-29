// Single shared Prisma client instance. Re-using one client avoids exhausting
// Postgres connections, which matters here because both the API process and
// the worker process import this module.

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
