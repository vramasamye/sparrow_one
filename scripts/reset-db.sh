#!/bin/bash

# ===========================================
# Sparrow - Reset Database Script
# ===========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠ This will delete all data and recreate the database!${NC}"
read -p "Are you sure? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Resetting database...${NC}"

    # Drop and recreate database
    docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS sparrow;"
    docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE sparrow;"

    # Push schema and seed
    npx prisma db push
    npm run db:seed

    echo -e "${GREEN}✓ Database reset complete!${NC}"
else
    echo "Cancelled."
fi
