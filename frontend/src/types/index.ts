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
  // Image conversion parameters
  format?: string;       
  quality?: number;
  width?: number;
  height?: number;

  // PDF extraction parameters
  extractImages?: boolean;
  extractTables?: boolean;
  outputFormat?: string;  // PDF uses 'outputFormat'
  pageRange?: {
    start?: number;
    end?: number;
  };
  
  // Video trimming parameters
  startTime?: string; 
  endTime?: string;   
  duration?: string;  
  
  
  
  // CSV analysis parameters
  delimiter?: string;
  hasHeader?: boolean;
  analysisType?: string;
  columns?: string[];
  generateCharts?: boolean;
  
  // Code execution parameters
  language?: string;
  timeout?: number;
  memoryLimit?: string;
  
  // Deployment parameters
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
  startedAt?: string;        
  completedAt?: string;
  processingTime?: number;  
  downloadUrl?: string;
  deploymentUrl?: string;
  error?: string;
  output?: string;           
  
  inputFile?: {
    filename: string;
    originalName: string;
    path: string;
    size: number;
    mimetype: string;
  };
  
  outputFile?: {
    filename: string;
    originalName: string;
    path: string;
    s3Key?: string;
    size: number;
    mimetype: string;
  };
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