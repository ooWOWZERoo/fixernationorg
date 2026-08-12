const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const db = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || "Admin";

  if (!email || !password) {
    console.error("ERROR: Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, role: "SUPER_ADMIN", emailVerified: new Date(), name },
    create: { email, name, passwordHash, role: "SUPER_ADMIN", emailVerified: new Date() },
  });

  console.log(`✓ Admin user ready: ${user.email} (${user.role})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
