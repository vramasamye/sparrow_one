#!/bin/bash

echo "🔍 Platform Optimization Verification Script"
echo "============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PASSED=0
FAILED=0

# Helper function
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $1${NC}"
        ((FAILED++))
    fi
}

# 1. Check database connection
echo "1. Database Connection"
docker-compose exec -T postgres psql -U postgres -d sparrow -c "SELECT 1;" > /dev/null 2>&1
check "Database is accessible"
echo ""

# 2. Check schema changes
echo "2. Schema Verification"
docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "\d topics" | grep -q "enableTwitter"
check "enableTwitter column exists"

docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "\d topics" | grep -q "enableLinkedin"
check "enableLinkedin column exists"

# Check if columns have correct defaults
TWITTER_DEFAULT=$(docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "SELECT column_default FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'enableTwitter';" | tr -d ' \n')
if [ "$TWITTER_DEFAULT" = "true" ]; then
    echo -e "${GREEN}✅ enableTwitter defaults to true${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ enableTwitter default is incorrect: $TWITTER_DEFAULT${NC}"
    ((FAILED++))
fi

LINKEDIN_DEFAULT=$(docker-compose exec -T postgres psql -U postgres -d sparrow -d sparrow -t -c "SELECT column_default FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'enableLinkedin';" | tr -d ' \n')
if [ "$LINKEDIN_DEFAULT" = "true" ]; then
    echo -e "${GREEN}✅ enableLinkedin defaults to true${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ enableLinkedin default is incorrect: $LINKEDIN_DEFAULT${NC}"
    ((FAILED++))
fi

# Check nullable fields
TWITTER_NULLABLE=$(docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'generated_posts' AND column_name = 'twitterContent';" | tr -d ' \n')
if [ "$TWITTER_NULLABLE" = "YES" ]; then
    echo -e "${GREEN}✅ twitterContent is nullable${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ twitterContent is not nullable${NC}"
    ((FAILED++))
fi

LINKEDIN_NULLABLE=$(docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'generated_posts' AND column_name = 'linkedinContent';" | tr -d ' \n')
if [ "$LINKEDIN_NULLABLE" = "YES" ]; then
    echo -e "${GREEN}✅ linkedinContent is nullable${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ linkedinContent is not nullable${NC}"
    ((FAILED++))
fi
echo ""

# 3. Check existing topics
echo "3. Topic Configuration"
TOPIC_COUNT=$(docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "SELECT COUNT(*) FROM topics;" | tr -d ' \n')
echo "Total topics: $TOPIC_COUNT"

if [ "$TOPIC_COUNT" -gt 0 ]; then
    echo ""
    echo "Platform status for all topics:"
    docker-compose exec -T postgres psql -U postgres -d sparrow -c "
        SELECT
            name,
            \"enableTwitter\" as twitter,
            \"enableLinkedin\" as linkedin,
            CASE
                WHEN \"enableTwitter\" AND \"enableLinkedin\" THEN 'Both'
                WHEN \"enableTwitter\" THEN 'Twitter Only'
                WHEN \"enableLinkedin\" THEN 'LinkedIn Only'
                ELSE 'INVALID'
            END as platforms
        FROM topics
        ORDER BY name;
    "

    # Check for invalid configurations
    INVALID=$(docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "SELECT COUNT(*) FROM topics WHERE \"enableTwitter\" = false AND \"enableLinkedin\" = false;" | tr -d ' \n')
    if [ "$INVALID" -eq 0 ]; then
        echo -e "${GREEN}✅ No topics with both platforms disabled${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ Found $INVALID topics with both platforms disabled${NC}"
        ((FAILED++))
    fi
fi
echo ""

# 4. Check generated posts
echo "4. Generated Posts Check"
GP_COUNT=$(docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "SELECT COUNT(*) FROM generated_posts;" | tr -d ' \n')
echo "Total generated posts: $GP_COUNT"

if [ "$GP_COUNT" -gt 0 ]; then
    echo ""
    echo "Content distribution:"
    docker-compose exec -T postgres psql -U postgres -d sparrow -c "
        SELECT
            COUNT(*) as total,
            COUNT(\"twitterContent\") as has_twitter,
            COUNT(\"linkedinContent\") as has_linkedin,
            COUNT(CASE WHEN \"twitterContent\" IS NULL THEN 1 END) as twitter_null,
            COUNT(CASE WHEN \"linkedinContent\" IS NULL THEN 1 END) as linkedin_null
        FROM generated_posts;
    "
fi
echo ""

# 5. API endpoint check (if server is running)
echo "5. API Endpoint Check"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Server appears to be running${NC}"
    echo "To test the API endpoint:"
    echo "  1. Log in as admin"
    echo "  2. Navigate to /admin/topics"
    echo "  3. Try toggling a platform switch"
else
    echo -e "${YELLOW}ℹ️  Server is not running (start with 'npm run dev' to test UI)${NC}"
fi
echo ""

# Summary
echo "======================================"
echo "Summary"
echo "======================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed!${NC}"
    echo ""
    echo "Ready to use:"
    echo "  1. Start server: npm run dev"
    echo "  2. Go to: http://localhost:3000/admin/topics"
    echo "  3. Test platform toggles"
    exit 0
else
    echo -e "${RED}⚠️  Some checks failed. Please review the errors above.${NC}"
    exit 1
fi
