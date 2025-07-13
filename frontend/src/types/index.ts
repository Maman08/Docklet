export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export type TaskType = 
  | 'image-convert'
  | 'video-trim'
  | 'pdf-extract'
  | 'csv-analyze'
  | 'code-execute'
  | 'deploy-app';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TaskParameters {
  outputFormat?: string;
  startTime?: number;
  endTime?: number;
  language?: string;
  timeout?: number;
  memoryLimit?: string;
  appType?: string;
  expirationHours?: number;
  port?: number;
  environment?: string;
}

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  fileName: string;
  fileSize: number;
  parameters: TaskParameters;
  progress: number;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  deploymentUrl?: string;
  error?: string;
}

export interface TaskSubmission {
  type: TaskType;
  file: File;
  parameters: TaskParameters;
}

export interface CodeExecution {
  language: string;
  code: string;
  timeout: number;
  memoryLimit: string;
}

export interface DeploymentInfo {
  url: string;
  status: 'active' | 'expired' | 'error';
  expiresAt: string;
  resourceUsage: {
    cpu: number;
    memory: number;
    traffic: number;
  };
}