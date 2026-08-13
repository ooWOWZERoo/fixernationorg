// Run: node scripts/seed-products.js
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  // Books
  const books = [
    {
      slug: "kill-the-bully",
      name: "Kill the Bully",
      description:
        "Alex Parker is done being the target. This is the story of what happens when a kid decides to stop absorbing the hits and find a different kind of power.",
      imageUrl: "/images/cover-kill-the-bully.png",
      sortOrder: 10,
    },
    {
      slug: "your-past-doesnt-define-you",
      name: "Your Past Doesn't Define You",
      description:
        "Sam's story is about what happens when pain turns inward. Emily's is about figuring out how to reach someone who keeps pulling away.",
      imageUrl: "/images/cover-your-past.png",
      sortOrder: 11,
    },
    {
      slug: "think-with-5-brains",
      name: "Think with 5 Brains, Then Make Up Your Mind",
      description:
        "A different approach to making decisions. This one challenges you to slow down and think from more than one angle before committing.",
      imageUrl: "/images/cover-5-brains.png",
      sortOrder: 12,
    },
    {
      slug: "how-to-lie",
      name: "How to Lie and Get Away With It Every Time",
      description:
        "A sharp look at how dishonesty works, why people do it, and how to protect yourself from it without becoming cynical.",
      imageUrl: "/images/cover-how-to-lie.png",
      sortOrder: 13,
    },
  ];

  for (const book of books) {
    await db.product.upsert({
      where: { slug: book.slug },
      create: { type: "BOOK", active: true, features: [], ...book },
      update: { name: book.name, description: book.description, imageUrl: book.imageUrl },
    });
    console.log(`✓ Book: ${book.name}`);
  }

  // Free with Book membership
  const freeProduct = await db.product.upsert({
    where: { slug: "free-with-book" },
    create: {
      type: "MEMBERSHIP",
      name: "Free with Book Purchase",
      slug: "free-with-book",
      description: "Scan the QR code inside any Fixer Nation book to activate a 90-day membership.",
      features: [
        "FN community access",
        "Daily Morning Boost emails",
        "Ask The Fixer",
        "Good for 3 months",
      ],
      active: true,
      sortOrder: 1,
    },
    update: {},
  });
  await db.price.upsert({
    where: { id: "price-free-with-book" },
    create: {
      id: "price-free-with-book",
      productId: freeProduct.id,
      interval: "ONE_TIME",
      amount: 0,
      trialDays: 90,
      membershipRole: "CONSUMER",
      active: true,
    },
    update: {},
  });
  console.log("✓ Membership: Free with Book");

  // Consumer Membership (monthly + annual prices)
  const consumerProduct = await db.product.upsert({
    where: { slug: "consumer-membership" },
    create: {
      type: "MEMBERSHIP",
      name: "Consumer Membership",
      slug: "consumer-membership",
      description: "Start with a 30-day free trial. No charge until the trial ends.",
      features: [
        "Everything in Free, plus:",
        "Full blog and library access",
        "Vetted Professional Network",
        "Mobile app access",
      ],
      active: true,
      sortOrder: 2,
    },
    update: {},
  });
  await db.price.upsert({
    where: { id: "price-consumer-monthly" },
    create: {
      id: "price-consumer-monthly",
      productId: consumerProduct.id,
      interval: "MONTHLY",
      amount: 700,
      trialDays: 30,
      membershipRole: "MEMBER",
      active: true,
    },
    update: {},
  });
  await db.price.upsert({
    where: { id: "price-consumer-annual" },
    create: {
      id: "price-consumer-annual",
      productId: consumerProduct.id,
      interval: "ANNUAL",
      amount: 6000,
      trialDays: 30,
      membershipRole: "MEMBER",
      active: true,
    },
    update: {},
  });
  console.log("✓ Membership: Consumer (monthly + annual)");

  console.log("\nAll products seeded.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
