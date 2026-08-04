/**
 * One-time script to create the initial admin user.
 * Run from the project root on the server:
 *
 *   node scripts/create-admin.js
 *
 * DATABASE_URL must be in the environment.
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const EMAIL = process.env.ADMIN_EMAIL || "admin@fixernation.org";
const PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe123!";

async function main() {
  const db = new PrismaClient();

  const existing = await db.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`User ${EMAIL} already exists — skipping.`);
    await db.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: "Admin",
      passwordHash,
      emailVerified: new Date(),
      role: "SUPER_ADMIN",
    },
  });

  console.log(`Created user: ${user.email} (role: ${user.role})`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
