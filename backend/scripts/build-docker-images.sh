#!/bin/bash

set -e

echo "Building Docker images for Task Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build image processor
echo -e "${YELLOW}Building image processor...${NC}"
cd docker-images/image-processor
docker build -t task-platform/image-processor:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Image processor built successfully${NC}"
else
    echo -e "${RED}Failed to build image processor${NC}"
    exit 1
fi
cd ../..

# Build video processor
echo -e "${YELLOW}Building video processor...${NC}"
cd docker-images/video-processor
docker build -t task-platform/video-processor:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Video processor built successfully${NC}"
else
    echo -e "${RED}Failed to build video processor${NC}"
    exit 1
fi
cd ../..

# List built images
echo -e "${YELLOW}Built images:${NC}"
docker images | grep task-platform

echo -e "${GREEN}All Docker images built successfully!${NC}"