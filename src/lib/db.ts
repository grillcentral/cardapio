// Customers are now managed via Prisma (PostgreSQL).
// This file is kept as a re-export for backwards compatibility
// but no longer opens any SQLite file.
export { prisma as default } from "@/lib/prisma";
