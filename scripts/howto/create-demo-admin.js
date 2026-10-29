/**
 * Creates (once) the demo admin used to record how-to videos, and writes its
 * credentials to .env.howto.local (git-ignored, mode 600). The password is
 * never printed. adminRole is ADMIN (not SUPER_ADMIN) and the user role is
 * CONSUMER, so the account has admin-panel access and nothing more. The CRM
 * Contact is created with no consent rows, so campaigns and journeys skip it.
 *
 *   DOTENV_CONFIG_PATH=.env.neon.local node -r dotenv/config scripts/howto/create-demo-admin.js demo@example.com
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const EMAIL = (process.argv[2] || "").trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(EMAIL)) {
  console.error("Usage: create-demo-admin.js <email>");
  process.exit(1);
}
const envFile = path.join(process.cwd(), ".env.howto.local");

async function main() {
  const db = new PrismaClient();
  try {
    const existing = await db.user.findUnique({ where: { email: EMAIL }, select: { id: true, adminRole: true } });
    if (existing) {
      console.log(`User ${EMAIL} already exists (adminRole ${existing.adminRole}); nothing changed.`);
      return;
    }

    const password = crypto.randomBytes(18).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: {
        email: EMAIL,
        name: "Demo Admin",
        passwordHash,
        emailVerified: new Date(),
        role: "CONSUMER",
        adminRole: "ADMIN",
      },
    });
    const contact = await db.contact.findUnique({ where: { email: EMAIL }, select: { id: true, userId: true } });
    if (contact) {
      if (!contact.userId) await db.contact.update({ where: { id: contact.id }, data: { userId: user.id } });
    } else {
      await db.contact.create({ data: { email: EMAIL, firstName: "Demo", lastName: "Admin", userId: user.id, source: "signup" } });
    }

    fs.writeFileSync(
      envFile,
      `HOWTO_BASE_URL=https://fixernation.org\nHOWTO_EMAIL=${EMAIL}\nHOWTO_PASSWORD=${password}\nHOWTO_ALLOW_PROD=1\n`,
      { mode: 0o600 }
    );
    console.log(`Created demo admin ${EMAIL} (adminRole ADMIN, role CONSUMER). Credentials saved to .env.howto.local.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
