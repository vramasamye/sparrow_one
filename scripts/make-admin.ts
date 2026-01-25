import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.log("Usage: npx tsx scripts/make-admin.ts <email>")
    console.log("Example: npx tsx scripts/make-admin.ts user@example.com")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    console.error(`User with email "${email}" not found`)
    process.exit(1)
  }

  if (user.role === "ADMIN") {
    console.log(`User "${email}" is already an admin`)
    process.exit(0)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  })

  console.log(`✓ User "${email}" is now an admin`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
