import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

console.log("DATABASE_URL:", process.env.DATABASE_URL?.slice(0, 60) + "...");
console.log("Connecting...");

const timer = setTimeout(() => {
  console.error("TIMEOUT: Prisma query took >15s - hanging");
  process.exit(1);
}, 15000);

try {
  const result = await prisma.$queryRaw`SELECT 1 as ping`;
  clearTimeout(timer);
  console.log("Prisma raw query OK:", JSON.stringify(result));
  const count = await prisma.permission.count();
  console.log("Permission count:", count);
  await prisma.$disconnect();
  console.log("Done");
  process.exit(0);
} catch (err) {
  clearTimeout(timer);
  console.error("Prisma error:", err.message);
  await prisma.$disconnect();
  process.exit(1);
}
