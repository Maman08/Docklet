import { TaskType } from '../types';
import { TASK_TYPES } from './constants';

export const validateFile = (file: File, taskType: TaskType): { valid: boolean; error?: string } => {
  const taskConfig = TASK_TYPES[taskType];
  
  // Check file size
  if (file.size > taskConfig.maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${formatFileSize(taskConfig.maxSize)} limit`
    };
  }

  // Check file format
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !taskConfig.supportedFormats.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported format. Supported: ${taskConfig.supportedFormats.join(', ')}`
    };
  }

  return { valid: true };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};