// Optional helper script: `npm run seed:senders -- <userEmail>`
// Creates a couple of extra Ethereal-backed senders for an existing user, so
// you can demo per-sender rate limiting with more than one sender.

import "dotenv/config";
import { prisma } from "../config/prisma";
import { createEtherealTestAccount } from "../services/mailService";
import { env } from "../config/env";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run seed:senders -- <userEmail>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}. Log in via Google first.`);
    process.exit(1);
  }

  for (const label of ["Sender B", "Sender C"]) {
    const account = await createEtherealTestAccount();
    const sender = await prisma.sender.create({
      data: {
        userId: user.id,
        label,
        ...account,
        maxEmailsPerHour: env.DEFAULT_MAX_EMAILS_PER_HOUR,
      },
    });
    console.log(`Created sender "${sender.label}" (${sender.fromAddress})`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
