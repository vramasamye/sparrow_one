#!/bin/bash
set -e

echo "🚀 Platform Optimization Setup Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if Docker is running
echo "Step 1: Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "Please start Docker Desktop and run this script again"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Step 2: Start PostgreSQL if not running
echo "Step 2: Starting PostgreSQL..."
if ! docker ps | grep -q sparrow-postgres; then
    echo "Starting database containers..."
    docker-compose up -d postgres
    echo "Waiting for PostgreSQL to be ready..."
    sleep 5
    docker-compose exec -T postgres pg_isready -U postgres || {
        echo "Waiting a bit more..."
        sleep 5
    }
else
    echo -e "${GREEN}✅ PostgreSQL is already running${NC}"
fi
echo ""

# Step 3: Run migration
echo "Step 3: Running Prisma migration..."
npx prisma migrate deploy
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi
echo ""

# Step 4: Verify schema
echo "Step 4: Verifying database schema..."
echo "Checking if enableTwitter column exists..."
docker-compose exec -T postgres psql -U postgres -d sparrow -c "\d topics" | grep enableTwitter > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ enableTwitter column exists${NC}"
else
    echo -e "${RED}❌ enableTwitter column not found${NC}"
    exit 1
fi

echo "Checking if enableLinkedin column exists..."
docker-compose exec -T postgres psql -U postgres -d sparrow -c "\d topics" | grep enableLinkedin > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ enableLinkedin column exists${NC}"
else
    echo -e "${RED}❌ enableLinkedin column not found${NC}"
    exit 1
fi
echo ""

# Step 5: Check existing topics
echo "Step 5: Checking existing topics..."
TOPIC_COUNT=$(docker-compose exec -T postgres psql -U postgres -d sparrow -t -c "SELECT COUNT(*) FROM topics;" | tr -d ' ')
echo "Found $TOPIC_COUNT topics in database"

if [ "$TOPIC_COUNT" -gt 0 ]; then
    echo ""
    echo "Platform configuration for existing topics:"
    docker-compose exec -T postgres psql -U postgres -d sparrow -c "SELECT name, \"enableTwitter\", \"enableLinkedin\" FROM topics ORDER BY name;"
fi
echo ""

# Step 6: Regenerate Prisma Client
echo "Step 6: Regenerating Prisma Client..."
npx prisma generate
echo -e "${GREEN}✅ Prisma Client regenerated${NC}"
echo ""

echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start the development server: npm run dev"
echo "2. Navigate to /admin/topics to see the platform toggles"
echo "3. Test toggling platforms on a topic"
echo "4. Approve a feed and verify only enabled platforms generate content"
echo ""
echo "To view the database schema:"
echo "  npx prisma studio"
echo ""
