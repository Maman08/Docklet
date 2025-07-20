# Docklet: Task Processing Engine

An application for asynchronous file processing and containerized GitHub deployments with scalable architecture.

## Core Architecture

- Express.js REST API with modular service layer
- Queue-based task processing to prevent race conditions
- Docker container isolation for each processing task
- AWS S3 integration with presigned URLs for secure file access

## Technical Features

### Concurrent Task Processing
- **Queue System**: Redis/MongoDB-based task queue preventing concurrent execution conflicts
- **Worker Pool**: Configurable concurrent task limit (`MAX_CONCURRENT_TASKS=5`)
- **Container Isolation**: Each task spawns isolated Docker containers to avoid resource conflicts
- **Port Management**: Dynamic port allocation with collision detection for GitHub deployments

### Secure File Handling
- **Presigned URLs**: 
  - Generated S3 URLs with time-based expiration (3600s) eliminating direct S3 access
  - Automatic `attachment` disposition forcing downloads instead of browser previews
  - Per-request URL generation ensuring single-use download links
  - Eliminates need for file streaming through application server, reducing bandwidth costs
- **Multi-stage Upload**: Local → S3 with automatic cleanup and rollback on failure
- **File Validation**: Upload middleware with size limits and type restrictions


## Processing Workflows

### File Processing Pipeline
```
Upload → Validation → S3 Storage → Queue → Docker Processing → Result Upload → Cleanup
```

### GitHub Deployment Flow
```
URL Validation → Git Clone → Docker Build → Port Allocation → Container Run → Health Check
```

## Technical Implementation

### Race Condition Prevention
- Task queue serialization
- Port allocation locking mechanism

## API Design

### RESTful Endpoints
- **POST /api/tasks/submit**: Multipart form data with file validation
- **GET /api/tasks/status/:taskId**: Real-time task progress 
- **GET /api/tasks/download/:taskId**: Presigned URL generation for secure downloads
- **POST /api/tasks/stop/:taskId**: Container termination

### Authentication & Authorization
- JWT-based stateless authentication
- User-scoped task isolation

  <img width="1918" height="935" alt="Screenshot from 2025-07-20 07-18-47" src="https://github.com/user-attachments/assets/2a53ce5c-e222-4cd3-954d-cc49367c6900" />

  <img width="1911" height="889" alt="Screenshot from 2025-07-20 07-18-00" src="https://github.com/user-attachments/assets/3cdff7d0-2d8a-44f5-9152-1fbbc0b81297" />
  
  <img width="1918" height="935" alt="Screenshot from 2025-07-20 07-48-20" src="https://github.com/user-attachments/assets/d12e55f2-3fcc-48d2-88f9-28b2ba4fa893" />

  <img width="1918" height="935" alt="Screenshot from 2025-07-20 07-48-34" src="https://github.com/user-attachments/assets/926b682c-8628-4ec7-98f1-ae274d6fe8d8" />


