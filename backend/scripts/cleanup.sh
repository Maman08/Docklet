#!/bin/bash

echo "Cleaning up Task Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Stop running containers
echo -e "${YELLOW}Stopping running containers...${NC}"
docker ps -q --filter "name=task_*" | xargs -r docker stop
docker ps -q --filter "name=task-platform*" | xargs -r docker stop

# Remove containers
echo -e "${YELLOW}Removing containers...${NC}"
docker ps -aq --filter "name=task_*" | xargs -r docker rm
docker ps -aq --filter "name=task-platform*" | xargs -r docker rm

# Clean up old files (older than 24 hours)
echo -e "${YELLOW}Cleaning up old files...${NC}"
find ./uploads -type f -mtime +1 -delete 2>/dev/null || true
find ./outputs -type f -mtime +1 -delete 2>/dev/null || true

# Clean up logs (keep last 5 files)
echo -e "${YELLOW}Cleaning up old logs...${NC}"
find ./logs -name "*.log*" -type f | head -n -5 | xargs -r rm

# Clean up Docker resources
echo -e "${YELLOW}Cleaning up Docker resources...${NC}"
docker system prune -f
docker volume prune -f

echo -e "${GREEN}Cleanup completed!${NC}"