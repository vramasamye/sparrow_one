#!/bin/bash

# Test all cron endpoints locally
# Requires: Dev server running on localhost:3000

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep CRON_SECRET | xargs)
fi

BASE_URL="https://sparrow-one-gold.vercel.app"
SECRET="${CRON_SECRET}"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   Testing All 8 Cron Jobs                                     ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Test each cron endpoint
test_cron() {
  local name=$1
  local endpoint=$2

  echo -e "${YELLOW}Testing:${NC} $name"
  echo "   Endpoint: $endpoint"

  # Make request
  response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $SECRET" \
    "$BASE_URL$endpoint")

  # Split response and status code
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  # Check status
  if [ "$http_code" -eq 200 ]; then
    echo -e "   ${GREEN}✓ Status: $http_code${NC}"
    echo "   Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body | head -c 100)"
    echo ""
    return 0
  else
    echo -e "   ${RED}✗ Status: $http_code${NC}"
    echo "   Response: $body"
    echo ""
    return 1
  fi
}

# Counter for results
passed=0
failed=0

# Run tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_cron "1. Publish Posts" "/api/cron/publish-posts" && ((passed++)) || ((failed++))
test_cron "2. Process Feeds" "/api/cron/process-feeds" && ((passed++)) || ((failed++))
test_cron "3. Cleanup" "/api/cron/cleanup" && ((passed++)) || ((failed++))
test_cron "4. Score Feeds" "/api/cron/score-feeds" && ((passed++)) || ((failed++))
test_cron "5. Refresh Tokens" "/api/cron/refresh-tokens" && ((passed++)) || ((failed++))
test_cron "6. Process Queue" "/api/cron/process-queue" && ((passed++)) || ((failed++))
test_cron "7. Master Cron" "/api/cron/master" && ((passed++)) || ((failed++))
test_cron "8. Manage Cron" "/api/cron/manage" && ((passed++)) || ((failed++))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   Test Results                                                 ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "   ${GREEN}✓ Passed: $passed${NC}"
echo -e "   ${RED}✗ Failed: $failed${NC}"
echo ""

if [ $failed -eq 0 ]; then
  echo -e "${GREEN}All cron jobs are working! ✅${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}Some cron jobs failed! ❌${NC}"
  echo ""
  exit 1
fi
