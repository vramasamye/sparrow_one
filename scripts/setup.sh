#!/bin/bash

# ===========================================
# Sparrow - Local Development Setup Script
# ===========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════╗"
echo "║     Sparrow - Local Development Setup     ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Docker is running
echo -e "${YELLOW}[1/7] Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if .env.local exists
echo -e "${YELLOW}[2/7] Checking environment file...${NC}"
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}Creating .env.local from .env.example...${NC}"
    cp .env.example .env.local

    # Generate secrets
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    CRON_SECRET=$(openssl rand -base64 32)

    # Replace placeholders (macOS compatible)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|your-nextauth-secret-here|$NEXTAUTH_SECRET|g" .env.local
        sed -i '' "s|ENCRYPTION_KEY=\"\"|ENCRYPTION_KEY=\"$ENCRYPTION_KEY\"|g" .env.local
        sed -i '' "s|dev-cron-secret-change-in-production|$CRON_SECRET|g" .env.local
    else
        sed -i "s|your-nextauth-secret-here|$NEXTAUTH_SECRET|g" .env.local
        sed -i "s|ENCRYPTION_KEY=\"\"|ENCRYPTION_KEY=\"$ENCRYPTION_KEY\"|g" .env.local
        sed -i "s|dev-cron-secret-change-in-production|$CRON_SECRET|g" .env.local
    fi

    echo -e "${GREEN}✓ Created .env.local with generated secrets${NC}"
    echo -e "${YELLOW}⚠ You still need to add OAuth credentials (Google, Twitter, LinkedIn) and AI API keys${NC}"
else
    echo -e "${GREEN}✓ .env.local already exists${NC}"
fi

# Start Docker containers
echo -e "${YELLOW}[3/7] Starting Docker containers (PostgreSQL + Redis)...${NC}"
docker-compose up -d
echo -e "${GREEN}✓ Docker containers started${NC}"

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}[4/7] Waiting for PostgreSQL to be ready...${NC}"
sleep 3
until docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Install dependencies
echo -e "${YELLOW}[5/7] Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Generate Prisma client and push schema
echo -e "${YELLOW}[6/7] Setting up database...${NC}"
npx prisma generate
npx prisma db push
echo -e "${GREEN}✓ Database schema pushed${NC}"

# Seed the database
echo -e "${YELLOW}[7/7] Seeding database with topics and RSS feeds...${NC}"
npm run db:seed
echo -e "${GREEN}✓ Database seeded${NC}"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Setup Complete! 🎉                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. ${YELLOW}Add OAuth credentials${NC} to .env.local:"
echo "   - Google: https://console.cloud.google.com/apis/credentials"
echo "   - Twitter: https://developer.twitter.com/en/portal/dashboard"
echo "   - LinkedIn: https://www.linkedin.com/developers/apps"
echo ""
echo "2. ${YELLOW}Add AI API key${NC} to .env.local:"
echo "   - Groq (recommended): https://console.groq.com/keys"
echo ""
echo "3. ${YELLOW}Start the development server:${NC}"
echo "   npm run dev"
echo ""
echo "4. ${YELLOW}Open in browser:${NC}"
echo "   http://localhost:3000"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  npm run dev          - Start development server"
echo "  npm run db:studio    - Open Prisma Studio (database GUI)"
echo "  npm run db:seed      - Re-seed the database"
echo "  docker-compose logs  - View container logs"
echo "  docker-compose down  - Stop containers"
echo ""
