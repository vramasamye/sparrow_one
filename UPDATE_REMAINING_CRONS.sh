#!/bin/bash

# This script shows what needs to be updated in the remaining cron jobs
# Each cron needs: 1) Import withDatabase 2) Wrap DB operations

cat << 'EOF'

REMAINING CRON JOBS TO UPDATE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. src/app/api/cron/refresh-tokens/route.ts
2. src/app/api/cron/master/route.ts
3. src/app/api/cron/manage/route.ts
4. src/app/api/cron/process-queue/route.ts
5. src/app/api/cron/score-feeds/route.ts

PATTERN TO APPLY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: Add import
  import { withDatabase } from "@/lib/cron-db"

Step 2: Wrap database operations
  const result = await withDatabase(async () => {
    // ... existing database logic
    return { ... }
  })

EXAMPLE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before:
  try {
    const accounts = await prisma.socialAccount.findMany({...})
    // ... process accounts
  }

After:
  try {
    const accounts = await withDatabase(async () => {
      const accounts = await prisma.socialAccount.findMany({...})
      // ... process accounts
      return accounts
    })
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF
