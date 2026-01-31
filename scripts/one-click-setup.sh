#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Platform Optimization - One-Click Setup              ║"
echo "║  Complete automated setup and verification            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print section headers
section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

section "🐳 Step 1: Docker Setup"
# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo ""
    echo "Please start Docker Desktop and run this script again:"
    echo -e "${YELLOW}  1. Open Docker Desktop${NC}"
    echo -e "${YELLOW}  2. Wait for it to fully start${NC}"
    echo -e "${YELLOW}  3. Run: ./scripts/one-click-setup.sh${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

section "🗄️  Step 2: Database Setup"
# Start PostgreSQL if not running
if ! docker ps | grep -q sparrow-postgres; then
    echo "Starting PostgreSQL container..."
    docker-compose up -d postgres
    echo "Waiting for PostgreSQL to be ready..."

    # Wait up to 30 seconds for PostgreSQL to be ready
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    echo ""
else
    echo -e "${GREEN}✅ PostgreSQL is already running${NC}"
fi

section "📊 Step 3: Database Migration"
echo "Applying platform optimization migration..."
npx prisma migrate deploy
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration applied successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    echo "Please check the error above and try again"
    exit 1
fi

section "🔧 Step 4: Generate Prisma Client"
npx prisma generate
echo -e "${GREEN}✅ Prisma Client regenerated${NC}"

section "✅ Step 5: Verification"
echo "Running verification checks..."
echo ""

# Quick verification
TOPICS=$(docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "SELECT COUNT(*) FROM topics;" 2>/dev/null | tr -d ' \n')
TWITTER_COL=$(docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "\d topics" 2>/dev/null | grep -c "enableTwitter")
LINKEDIN_COL=$(docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "\d topics" 2>/dev/null | grep -c "enableLinkedin")

if [ "$TWITTER_COL" -eq 1 ] && [ "$LINKEDIN_COL" -eq 1 ]; then
    echo -e "${GREEN}✅ Schema columns added successfully${NC}"
else
    echo -e "${RED}❌ Schema verification failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found $TOPICS topics in database${NC}"

if [ "$TOPICS" -gt 0 ]; then
    echo ""
    echo "Platform configuration:"
    docker-compose exec -T postgres psql -U postgres -d sparrow -c "SELECT name, \"enableTwitter\" as twitter, \"enableLinkedin\" as linkedin FROM topics LIMIT 5;" 2>/dev/null
fi

section "🎉 Setup Complete!"
echo -e "${GREEN}All systems are ready!${NC}"
echo ""
echo "Next steps:"
echo ""
echo -e "  ${YELLOW}1.${NC} Start the development server:"
echo -e "     ${BLUE}npm run dev${NC}"
echo ""
echo -e "  ${YELLOW}2.${NC} Open in browser:"
echo -e "     ${BLUE}http://localhost:3000/admin/topics${NC}"
echo ""
echo -e "  ${YELLOW}3.${NC} Test the platform toggles:"
echo "     • You'll see 🐦 Twitter and 💼 LinkedIn switches"
echo "     • Try toggling them on different topics"
echo "     • Create a single-platform topic and approve a feed"
echo ""
echo -e "  ${YELLOW}4.${NC} Monitor cost savings:"
echo "     • Check logs for 'Skipping' messages"
echo "     • Run: docker-compose logs -f app"
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}💡 Tip:${NC} Run ${BLUE}./scripts/verify-platform-optimization.sh${NC}"
echo "    for detailed verification results"
echo ""
