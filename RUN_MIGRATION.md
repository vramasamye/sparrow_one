# 🚨 CRITICAL: Run Database Migration

## You Must Run This Before Scoring Can Work

The feed scoring system requires new database fields. Run the migration now:

```bash
# Option 1: Push schema changes (recommended for development)
npm run db:push

# Option 2: Use migrations (recommended for production)
npx prisma migrate deploy
```

## What This Adds

New fields to the `Feed` table:
- `qualityScore` (0-100)
- `sourceAuthorityScore` (0-20)
- `recencyScore` (0-15)
- `metadataScore` (0-15)
- `moderationScore` (0-1)
- `moderationCategory` (safe/unsafe/sales/spam)
- `moderationReasoning` (text)
- `isSafe` (boolean)
- `isSalesContent` (boolean)
- `hasPromoCodes` (boolean)
- `isClickbait` (boolean)
- `isTrending` (boolean)
- `autoApproved` (boolean)
- `autoRejected` (boolean)
- `scoredAt` (timestamp)

## Verify Migration Worked

```bash
# Open Prisma Studio
npx prisma studio

# Check the Feed table - you should see all the new fields listed above
```

## Next Steps

After migration completes:
1. ✅ Add GROQ_API_KEY to .env
2. ✅ Test scoring: `npm run score-feeds -- --limit 10`
3. ✅ Deploy cron: `npm run setup-cron:balanced`

---

**Status**: ⚠️ **PENDING - YOU MUST RUN THIS MIGRATION**
