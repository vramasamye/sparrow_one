# Natural Social Media Automation - Scheduling Implementation

## Overview
Transform Sparrow into a natural social media automation platform with personalized scheduling based on user timezone and preferences.

## Current Issues

### 1. All Users Post at Same Times
- Currently uses hardcoded UTC times: `[9, 12, 15, 17, 19, 21]`
- All users' posts scheduled at same UTC times
- Not natural - everyone posts simultaneously
- No timezone consideration

### 2. No User Control
- Users can't choose when their posts publish
- No timezone settings
- No posting frequency control
- No "quiet hours" support

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Natural Scheduling                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Preferences                                            │
│  ├── Timezone (e.g., "America/New_York")                    │
│  ├── Posting Schedule (6 time slots)                        │
│  │   ├── Slot 1: 08:00 (local time)                        │
│  │   ├── Slot 2: 10:00                                      │
│  │   ├── Slot 3: 12:00                                      │
│  │   ├── Slot 4: 14:00                                      │
│  │   ├── Slot 5: 17:00                                      │
│  │   └── Slot 6: 19:00                                      │
│  ├── Posts Per Week (1-14)                                   │
│  ├── Separate schedules for Twitter vs LinkedIn             │
│  └── Active Days (Mon-Sun)                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Database Changes

#### 1. Add UserPreferences Model

```prisma
model UserPreferences {
  id        String   @id @default(cuid())
  userId    String   @unique

  // Timezone
  timezone  String   @default("UTC") // IANA timezone (e.g., "America/New_York")

  // Posting Schedule
  twitterTimes   Json  // Array of hours [8, 10, 12, 14, 17, 19]
  linkedinTimes  Json  // Array of hours [9, 11, 13, 16, 18, 20]

  // Posting Frequency
  postsPerWeek   Int   @default(7)  // 1-14 posts per week

  // Active Days (0=Sunday, 6=Saturday)
  activeDays     Json  @default("[1,2,3,4,5]") // Mon-Fri by default

  // Quiet Hours
  quietStart     Int?  // Hour when to stop posting (e.g., 22 = 10pm)
  quietEnd       Int?  // Hour when to resume posting (e.g., 7 = 7am)

  // Meta
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_preferences")
}
```

Update User model:
```prisma
model User {
  // ... existing fields
  preferences UserPreferences?

  @@map("users")
}
```

### Implementation Plan

## Phase 1: Database & Core Logic

### 1.1 Schema Migration
- Add `UserPreferences` model
- Update User model relation
- Create migration file
- Run migration

### 1.2 Update Scheduler Logic
Create new `src/lib/natural-scheduler.ts`:
- `getUserSchedulePreferences()` - Get user's timezone and posting times
- `getNextNaturalSlot()` - Calculate next posting time in user's timezone
- `distributeNaturally()` - Distribute posts using natural scheduling
- Support for:
  - Timezone conversion
  - User-specific posting times
  - Quiet hours
  - Active days
  - Posts per week limits

### 1.3 Smart Scheduling Algorithm
```typescript
function getNextNaturalSlot(userId, platform, preferences) {
  // 1. Get user's timezone
  // 2. Convert current time to user's timezone
  // 3. Find next available slot from user's preferred times
  // 4. Respect quiet hours
  // 5. Check active days
  // 6. Ensure no conflicts with existing posts
  // 7. Return scheduled time in UTC
}
```

## Phase 2: API Endpoints

### 2.1 Preferences Management
**GET /api/user/preferences**
- Get current user preferences
- Return default if none set

**PUT /api/user/preferences**
- Update user preferences
- Validate timezone
- Validate posting times
- Reschedule existing posts (optional)

**POST /api/user/preferences/reset**
- Reset to default preferences

### 2.2 Preview Endpoint
**POST /api/user/preferences/preview**
- Preview next 7 days of posting schedule
- Show times in user's timezone
- Help users visualize their schedule

## Phase 3: User Interface

### 3.1 Preferences Page (`/settings/schedule`)

**Components:**
- Timezone Selector (dropdown with search)
- Time Slot Editor (6 customizable slots per platform)
- Visual Calendar Preview (next 7 days)
- Posts Per Week Slider (1-14)
- Active Days Selector (Mon-Sun checkboxes)
- Quiet Hours Range Selector
- Save/Reset buttons

**Design:**
```
┌─────────────────────────────────────────────────────────┐
│ Posting Schedule                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Timezone: [America/New_York ▼]                          │
│                                                          │
│ ─── Twitter Schedule ───────────────────────────────    │
│ 🐦 Posting Times (6 slots per day)                      │
│   [08:00 ▼] [10:00 ▼] [12:00 ▼]                        │
│   [14:00 ▼] [17:00 ▼] [19:00 ▼]                        │
│                                                          │
│ ─── LinkedIn Schedule ──────────────────────────────    │
│ 💼 Posting Times (6 slots per day)                      │
│   [09:00 ▼] [11:00 ▼] [13:00 ▼]                        │
│   [16:00 ▼] [18:00 ▼] [20:00 ▼]                        │
│                                                          │
│ ─── Posting Frequency ──────────────────────────────    │
│ Posts per week: [━━━━━○━━━━] 7 posts                    │
│                                                          │
│ ─── Active Days ────────────────────────────────────    │
│ [✓] Mon  [✓] Tue  [✓] Wed  [✓] Thu  [✓] Fri            │
│ [ ] Sat  [ ] Sun                                         │
│                                                          │
│ ─── Quiet Hours ────────────────────────────────────    │
│ Don't post between [22:00 ▼] and [07:00 ▼]             │
│                                                          │
│ ─── Next 7 Days Preview ────────────────────────────    │
│ Mon Jan 30: 08:00, 12:00, 17:00 (3 posts)               │
│ Tue Jan 31: 10:00, 14:00 (2 posts)                      │
│ Wed Feb 1:  08:00, 19:00 (2 posts)                      │
│ ...                                                      │
│                                                          │
│ [Reset to Default]  [Save Schedule]                     │
└─────────────────────────────────────────────────────────┘
```

## Phase 4: Migration & Defaults

### 4.1 Default Preferences
When user first signs up:
- Timezone: Auto-detect from browser
- Twitter: [8, 10, 12, 14, 17, 19] (local time)
- LinkedIn: [9, 11, 13, 16, 18, 20] (local time)
- Posts per week: 7 (1 per day)
- Active days: Monday-Friday
- No quiet hours

### 4.2 Existing Users Migration
Create migration script:
- Set default preferences for all existing users
- Use UTC timezone initially
- Option to bulk-update timezone by country detection

## Phase 5: Advanced Features

### 5.1 Smart Scheduling
- **Engagement Analysis**: Track which times get best engagement
- **Auto-Optimization**: Suggest better posting times based on performance
- **Seasonal Adjustment**: Adjust for daylight saving time
- **Holiday Awareness**: Skip posting on holidays (optional)

### 5.2 Batch Operations
- **Pause Scheduling**: Temporarily pause all posts
- **Vacation Mode**: Disable posting for date range
- **Bulk Reschedule**: Reschedule all pending posts to new times

### 5.3 Analytics
- **Posting Heatmap**: Visual heatmap of posting activity
- **Timezone Coverage**: Show global distribution of posting times
- **Engagement by Time**: Best performing times

## Implementation Steps

### Step 1: Database
```bash
# 1. Update schema.prisma
# 2. Create migration
npx prisma migrate dev --name add_user_preferences

# 3. Generate Prisma client
npx prisma generate
```

### Step 2: Core Logic
```bash
# Files to create/update:
- src/lib/natural-scheduler.ts (new)
- src/lib/timezone-utils.ts (new)
- src/lib/auto-scheduler.ts (update to use natural-scheduler)
```

### Step 3: API Routes
```bash
# Files to create:
- src/app/api/user/preferences/route.ts
- src/app/api/user/preferences/preview/route.ts
- src/app/api/user/preferences/reset/route.ts
```

### Step 4: UI Components
```bash
# Files to create:
- src/app/(dashboard)/settings/schedule/page.tsx
- src/components/schedule/timezone-selector.tsx
- src/components/schedule/time-slot-editor.tsx
- src/components/schedule/schedule-preview.tsx
- src/components/schedule/active-days-selector.tsx
```

### Step 5: Testing
```bash
# Test scenarios:
- Different timezones (EST, PST, UTC, Asia/Tokyo, etc.)
- Edge cases (midnight, timezone boundaries)
- Quiet hours crossing midnight
- All 7 days active vs weekdays only
- Different posts per week (1, 7, 14)
```

## Benefits

### For Users
✅ **Personalized Scheduling** - Posts at times that make sense for their audience
✅ **Timezone Aware** - No more 3am posts
✅ **Full Control** - Choose exact posting times
✅ **Natural Appearance** - Posts distributed throughout day/week
✅ **Work-Life Balance** - Set quiet hours, weekends off

### For Platform
✅ **Better Engagement** - Posts at optimal times for each user
✅ **Reduced Server Load** - Posts spread across 24 hours
✅ **Professional Image** - True automation platform
✅ **Competitive Advantage** - Feature parity with Buffer, Hootsuite
✅ **User Retention** - More control = happier users

## Default Schedules by Use Case

### Personal Brand
- Posts per week: 5-7
- Twitter: [8, 12, 17, 19]
- LinkedIn: [9, 13, 17]
- Active days: Mon-Fri
- Quiet hours: 22:00-07:00

### Business
- Posts per week: 10-14
- Twitter: [8, 10, 12, 14, 16, 18, 20]
- LinkedIn: [9, 11, 13, 15, 17, 19]
- Active days: Mon-Sun
- No quiet hours

### News/Media
- Posts per week: 14
- Twitter: [6, 8, 10, 12, 14, 16, 18, 20, 22]
- LinkedIn: [8, 12, 17]
- Active days: Mon-Sun
- No quiet hours

## Migration Timeline

**Week 1:** Database schema, core logic, API endpoints
**Week 2:** UI components, preferences page
**Week 3:** Testing, bug fixes, migration script
**Week 4:** Beta testing with select users
**Week 5:** Full rollout, documentation

## Success Metrics

- **90%+ users** set custom timezone within first week
- **70%+ users** customize posting times
- **50%+ improvement** in perceived post quality (survey)
- **Zero** timezone-related complaints
- **25%+ reduction** in support tickets about posting times

## Dependencies

```json
{
  "dependencies": {
    "date-fns": "^4.1.0",  // Already installed
    "date-fns-tz": "^3.2.0",  // Add for timezone support
    "countries-and-timezones": "^3.6.0"  // Timezone data
  }
}
```

## Risks & Mitigation

### Risk 1: Timezone Complexity
**Mitigation:** Use battle-tested libraries (date-fns-tz), extensive testing

### Risk 2: DST Issues
**Mitigation:** IANA timezone database handles DST automatically

### Risk 3: Migration Complexity
**Mitigation:** Careful migration script, default to UTC, gradual rollout

### Risk 4: Performance Impact
**Mitigation:** Cache preferences, optimize queries, use database indexes

## Future Enhancements

1. **Team Accounts** - Shared schedules for teams
2. **Custom Schedules per Topic** - Different times for different content types
3. **A/B Testing** - Test different posting schedules
4. **Smart Recommendations** - ML-based time suggestions
5. **Bulk Import** - Import schedule from CSV
6. **Calendar Integration** - Sync with Google Calendar

---

## Next Steps

1. ✅ Review and approve this plan
2. ⏳ Create database migration
3. ⏳ Implement natural-scheduler.ts
4. ⏳ Create API endpoints
5. ⏳ Build UI components
6. ⏳ Test thoroughly
7. ⏳ Deploy to production
