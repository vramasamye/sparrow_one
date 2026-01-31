# Remaining Cron Jobs to Wrap

These 4 cron jobs have the `withDatabase` import but need their database operations wrapped.

## Pattern to Apply

Find the main `try` block and wrap all database operations:

**Before:**
```typescript
try {
  const result = await someFunction()  // This function uses Prisma
  return NextResponse.json({ success: true, result })
} catch (error) {
  // error handling
}
```

**After:**
```typescript
try {
  const result = await withDatabase(async () => {
    return await someFunction()  // This function uses Prisma
  })
  return NextResponse.json({ success: true, result })
} catch (error) {
  // error handling
}
```

---

## Files to Update

1. **src/app/api/cron/refresh-tokens/route.ts**
   - Find: Main database operation
   - Wrap: Token refresh logic

2. **src/app/api/cron/master/route.ts**
   - Find: Main database operation
   - Wrap: Master cron logic

3. **src/app/api/cron/manage/route.ts**
   - Find: Main database operation
   - Wrap: Management logic

4. **src/app/api/cron/process-queue/route.ts**
   - Find: Main database operation
   - Wrap: Queue processing logic

---

## Quick Fix Command

If these cron jobs follow standard patterns, you can manually add the wrapper:

1. Open each file
2. Find the line with `await someFunction()` that uses Prisma
3. Wrap it:
   ```typescript
   const result = await withDatabase(async () => {
     return await someFunction()
   })
   ```

---

## Deploy Status

**DO NOT DEPLOY YET** until all 8 cron jobs are fully updated.

Currently ready:
- ✅ publish-posts
- ✅ process-feeds
- ✅ cleanup
- ✅ score-feeds

Still needs wrapping:
- ⏳ refresh-tokens
- ⏳ master
- ⏳ manage
- ⏳ process-queue

---

## Alternative: Deploy with 4 Working Crons

If you want to deploy NOW with just the 4 working crons:

1. The 4 updated crons will work ✅
2. The 4 remaining crons will still fail ❌
3. Update the remaining 4 later

This is safe because each cron is independent.
