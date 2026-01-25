import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { prisma } from "../src/lib/prisma"

async function main() {
  await prisma.scheduledPost.update({
    where: { id: "cmktt0blp00e9sx2zl22uhq1n" },
    data: {
      status: "SCHEDULED",
      errorMessage: null
    }
  })

  console.log("✅ Post reset to SCHEDULED status")
  await prisma.$disconnect()
}

main()
