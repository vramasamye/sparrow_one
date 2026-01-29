# Sales & Promotional Content Detection

## 🚫 Auto-Rejection Rule: NO ADS, NO SALES

Your newsletter will **automatically reject** any content that:
1. Tries to sell products/services
2. Contains coupon/promo codes
3. Uses sales language ("Buy now", "Limited offer", etc.)
4. Includes affiliate marketing
5. Pushes paid subscriptions with discounts

---

## 🤖 How AI Detects Sales Content

### **Detection Signals:**

#### **Strong Sales Indicators (Instant Rejection):**
- ✅ Coupon codes: "SAVE20", "DISCOUNT50", "PROMO2024"
- ✅ Pricing with discounts: "$99 → $49", "50% off", "Save $100"
- ✅ Call-to-action: "Buy now", "Subscribe today", "Get started"
- ✅ Urgency language: "Limited time", "Only 3 days left", "Act now"
- ✅ Affiliate links: "Click here to save", "Use our link"

#### **Medium Sales Indicators:**
- ⚠️ Product pricing mentioned prominently
- ⚠️ "Free trial" with urgency
- ⚠️ Comparison charts with "Choose plan" buttons
- ⚠️ Sponsored content labels

#### **NOT Sales (Legitimate Content):**
- ✅ Open-source releases (free software)
- ✅ Product announcements without pricing
- ✅ Technical tutorials
- ✅ Engineering blog posts
- ✅ Conference talks/announcements
- ✅ Research papers

---

## 📋 Real-World Examples

### ❌ REJECTED: Sales Content

#### 1. Course Promotion
```
Title: "Master React in 30 Days - Limited Time Offer"

Content:
"Enroll in our comprehensive React course today and save $100!
Use code REACT100 at checkout. Only valid this week!"

Detection:
✅ isSalesContent: true (selling a course)
✅ hasPromoCodes: true (REACT100)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-REJECTED ❌
Reason: "Sales/promotional content, Contains promo codes"
```

#### 2. SaaS Product Sale
```
Title: "New Project Management Tool - Get 50% Off"

Content:
"Transform your workflow with our new PM tool.
Special launch offer: 50% off annual plans with code LAUNCH50"

Detection:
✅ isSalesContent: true (product sale)
✅ hasPromoCodes: true (LAUNCH50)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-REJECTED ❌
Reason: "Sales/promotional content, Contains promo codes"
```

#### 3. Affiliate Marketing
```
Title: "Best Web Hosting Services of 2024"

Content:
"We've partnered with leading hosting providers to bring you
exclusive discounts. Click here to save 30% on hosting!"

Detection:
✅ isSalesContent: true (affiliate marketing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-REJECTED ❌
Reason: "Sales/promotional content"
```

#### 4. Subscription Push
```
Title: "Upgrade to Premium - Special Offer Inside"

Content:
"Get full access to all features with Premium.
Subscribe now and save 40% with code PREMIUM40"

Detection:
✅ isSalesContent: true (subscription sale)
✅ hasPromoCodes: true (PREMIUM40)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-REJECTED ❌
Reason: "Sales/promotional content, Contains promo codes"
```

---

### ✅ APPROVED: Legitimate Content

#### 1. Open Source Release
```
Title: "React 19 Beta Now Available"

Content:
"The React team has released React 19 beta with new features
including the compiler, Actions, and improved performance."

Detection:
❌ isSalesContent: false (free, open source)
❌ hasPromoCodes: false
✅ contentQuality: 10/10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-APPROVED ✅
Score: 95/100
```

#### 2. Product Announcement (No Sales)
```
Title: "Vercel Announces Next.js 15 with Turbopack"

Content:
"Today we're excited to announce Next.js 15, featuring
Turbopack for faster builds and improved performance."

Detection:
❌ isSalesContent: false (announcement, not selling)
❌ hasPromoCodes: false
✅ contentQuality: 9/10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-APPROVED ✅
Score: 92/100
```

#### 3. Tutorial/Educational
```
Title: "Building a Real-Time Chat App with WebSockets"

Content:
"Learn how to build a production-ready chat application
using WebSockets, Node.js, and React."

Detection:
❌ isSalesContent: false (educational tutorial)
❌ hasPromoCodes: false
✅ contentQuality: 8/10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-APPROVED ✅
Score: 85/100
```

#### 4. Technical Analysis
```
Title: "PostgreSQL vs MySQL: Performance Benchmarks"

Content:
"We ran comprehensive benchmarks comparing PostgreSQL
and MySQL across various workloads. Here are the results."

Detection:
❌ isSalesContent: false (objective comparison)
❌ hasPromoCodes: false
✅ contentQuality: 9/10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-APPROVED ✅
Score: 88/100
```

---

## 🎯 Detection Logic

```typescript
// Pseudo-code for AI sales detection

function analyzeSalesContent(article) {
  // Check for explicit promo codes
  const promoCodePatterns = [
    /code\s+[A-Z0-9]+/i,
    /promo\s*:?\s*[A-Z0-9]+/i,
    /discount\s+code/i,
    /coupon\s+[A-Z0-9]+/i,
    /save\d+/i
  ]

  hasPromoCodes = promoCodePatterns.some(pattern =>
    pattern.test(article.title + article.content)
  )

  // Check for sales language
  const salesPhrases = [
    'buy now', 'limited offer', 'save money',
    'get discount', 'subscribe and save',
    '% off', 'special price', 'exclusive deal',
    'act now', 'limited time', 'while supplies last'
  ]

  salesLanguageCount = salesPhrases.filter(phrase =>
    article.content.toLowerCase().includes(phrase)
  ).length

  // Check for pricing with incentives
  hasPricingWithDiscounts =
    (article.content.includes('$') || article.content.includes('price')) &&
    (article.content.includes('discount') || article.content.includes('save'))

  // Final determination
  isSalesContent =
    hasPromoCodes ||
    salesLanguageCount >= 2 ||
    hasPricingWithDiscounts

  return { isSalesContent, hasPromoCodes }
}
```

---

## 🔍 Edge Cases

### **Borderline Cases:**

#### Case 1: Product Launch Without Discount
```
Title: "Introducing Our New API Platform"
Content: "We're launching a new API platform. Pricing starts at $99/month."

Decision: ✅ APPROVED
Reason: Announcement, not actively selling with discounts
```

#### Case 2: Conference Ticket Sales
```
Title: "React Conf 2024 - Early Bird Tickets Available"
Content: "Get early bird pricing - tickets from $299"

Decision: ⚠️ PENDING (Admin decides)
Reason: Event tickets are borderline sales
Score: 65/100 (within manual review range)
```

#### Case 3: Free Trial Announcement
```
Title: "Try Our New Developer Tool - Free Forever Plan"
Content: "We're launching a free forever plan for developers"

Decision: ✅ APPROVED
Reason: Genuinely free offering, no pressure
```

#### Case 4: Sponsored Tutorial
```
Title: "Building Apps with [Sponsor Tool]"
Content: "Tutorial on using Tool X. This post is sponsored by Company Y."

Decision: ⚠️ PENDING
Reason: Sponsored content disclosed, educational value present
Score: 72/100 (manual review)
```

---

## 📊 Expected Impact

### **Before Sales Detection:**
```
100 feeds fetched
├─ 85 legitimate content
├─ 10 low quality
└─ 5 sales/promo content (would slip through)
```

### **After Sales Detection:**
```
100 feeds fetched
├─ 85 legitimate content → AUTO-APPROVED ✅
├─ 10 low quality → AUTO-REJECTED ❌
└─ 5 sales/promo → AUTO-REJECTED ❌ (NEW)

Result: 0 sales content reaches users! 🎉
```

---

## ⚙️ Configuration

### **Strictness Levels:**

You can configure how strict the sales detection should be:

```typescript
// config/sales-detection.ts

export const SALES_DETECTION_CONFIG = {
  // Strict mode: Reject anything remotely sales-y
  strict: {
    rejectOnPricing: true,        // Reject if pricing mentioned
    rejectOnCTA: true,            // Reject on any call-to-action
    allowSponsoredContent: false, // No sponsored posts
    minimumSalesScore: 3          // Reject if 3+ sales signals
  },

  // Balanced mode: Only reject obvious sales (RECOMMENDED)
  balanced: {
    rejectOnPricing: false,       // Pricing alone OK
    rejectOnCTA: false,           // CTA alone OK
    allowSponsoredContent: true,  // Allow if disclosed
    minimumSalesScore: 5          // Reject if 5+ sales signals
  },

  // Lenient mode: Only reject blatant promotions
  lenient: {
    rejectOnPricing: false,
    rejectOnCTA: false,
    allowSponsoredContent: true,
    minimumSalesScore: 7          // Very high threshold
  }
}
```

**Recommendation:** Start with **Balanced** mode, adjust based on results.

---

## 🛠️ Monitoring & Adjustment

### **Weekly Review:**

Check these metrics to ensure accuracy:

```sql
-- False Positive Check (good content rejected as sales)
SELECT title, url, aiReasoning
FROM Feed
WHERE isSalesContent = true
  AND status = 'REJECTED'
ORDER BY createdAt DESC
LIMIT 20;

-- Review to see if AI is too strict
```

```sql
-- False Negative Check (sales content that got through)
SELECT title, url, status
FROM Feed
WHERE qualityScore >= 80
  AND isSalesContent = false
  AND status = 'APPROVED'
ORDER BY createdAt DESC
LIMIT 20;

-- Manually check if any are actually sales
```

### **Adjustment:**

If you see false positives (good content rejected):
1. Review the `aiReasoning` field
2. Add exceptions to AI prompt
3. Lower strictness level

If you see false negatives (sales got through):
1. Review what patterns were missed
2. Update sales phrase detection
3. Increase strictness level

---

## 🎯 Success Criteria

After 1 week of operation:

**Target Metrics:**
- ✅ Sales detection accuracy: ≥95%
- ✅ False positive rate: <5%
- ✅ False negative rate: <2%
- ✅ User complaints about ads: 0

**Monitor:**
- Review first 100 rejections manually
- Adjust AI prompt if needed
- Fine-tune scoring thresholds

---

## Summary

With AI-powered sales detection, your newsletter will:

✅ **Automatically reject** promotional content
✅ **Block coupon codes** and discount offers
✅ **Filter out** affiliate marketing
✅ **Maintain quality** by only sharing genuine content
✅ **Save time** - no manual checking for sales posts

**Result:** Clean, valuable, ad-free content for your users! 🎉
