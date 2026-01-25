#!/bin/bash

# ===========================================
# Sparrow - Test Cron Jobs Locally
# ===========================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${1:-http://localhost:3000}"
CRON_SECRET=$(grep CRON_SECRET .env.local | cut -d'"' -f2)

echo -e "${BLUE}Testing Cron Jobs at ${BASE_URL}${NC}"
echo ""

# Test Process Feeds
echo -e "${YELLOW}[1/4] Testing Process Feeds...${NC}"
curl -s -X GET "${BASE_URL}/api/cron/process-feeds" \
    -H "Authorization: Bearer ${CRON_SECRET}" | jq .
echo ""

# Test Token Refresh
echo -e "${YELLOW}[2/4] Testing Token Refresh...${NC}"
curl -s -X GET "${BASE_URL}/api/cron/refresh-tokens" \
    -H "Authorization: Bearer ${CRON_SECRET}" | jq .
echo ""

# Test Cleanup
echo -e "${YELLOW}[3/4] Testing Cleanup...${NC}"
curl -s -X GET "${BASE_URL}/api/cron/cleanup" \
    -H "Authorization: Bearer ${CRON_SECRET}" | jq .
echo ""

# Test Publish Posts
echo -e "${YELLOW}[4/4] Testing Publish Posts...${NC}"
curl -s -X GET "${BASE_URL}/api/cron/publish-posts" \
    -H "Authorization: Bearer ${CRON_SECRET}" | jq .
echo ""

echo -e "${GREEN}✓ All cron jobs tested!${NC}"
