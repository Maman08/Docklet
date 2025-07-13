#!/bin/bash
# scripts/build-docker-images.sh

set -e

echo "Building Docker images for task processing..."

images=(
    "image-processor"
    "video-processor" 
    "pdf-processor"
    "csv-analyzer"
)

for image in "${images[@]}"; do
    echo "Building $image..."
    docker build -t "task-platform/$image:latest" "./docker-images/$image/"
    echo "✓ Built task-platform/$image:latest"
done

echo "All Docker images built successfully!"

echo -e "\nBuilt images:"
docker images | grep "task-platform"