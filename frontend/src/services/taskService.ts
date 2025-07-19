import axios from 'axios';
import { Task, TaskSubmission, TaskType } from '../types';

const API_BASE_URL = 'https://54.211.169.39:3000/api';

class TaskService {
  async submitTask(submission: TaskSubmission): Promise<{ taskId: string; estimatedTime?: number }> {
    const formData = new FormData();
    formData.append('file', submission.file);
    formData.append('type', submission.type);
    formData.append('parameters', JSON.stringify(submission.parameters));

    // Debug logging
    console.log('Submitting task:', {
      type: submission.type,
      fileName: submission.file.name,
      fileSize: submission.file.size,
      parameters: submission.parameters,
      parametersString: JSON.stringify(submission.parameters)
    });

    const token = localStorage.getItem('token');
    console.log('Auth token exists:', !!token);

    try {
      const response = await axios.post(`${API_BASE_URL}/tasks/submit`, formData, {
        headers: {
          // Remove explicit Content-Type - let browser set it with boundary
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        // Add timeout to prevent hanging
        timeout: 60000
      });
      return response.data;
    } catch (error: any) {
      console.error('Submit task error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        message: error.message
      });
      throw error;
    }
  }

  async getTaskStatus(taskId: string): Promise<Task> {
    const response = await axios.get(`${API_BASE_URL}/tasks/status/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.data;
  }

  async downloadFile(taskId: string): Promise<void> {
    // First get the presigned URL from your backend
    const response = await axios.get(`${API_BASE_URL}/tasks/download/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    // Backend now returns: { downloadUrl, filename, size, expiresIn }
    const { downloadUrl, filename } = response.data;

    // Use browser's native download mechanism to avoid CORS issues
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async getUserTasks(userId: string): Promise<Task[]> {
    const response = await axios.get(`${API_BASE_URL}/tasks/profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    // Backend returns { user, tasks }
    return response.data.tasks || [];
  }

  getDownloadUrl(taskId: string): string {
    return `${API_BASE_URL}/tasks/download/${taskId}`;
  }

  // Helper method to get download info without actually downloading
  async getDownloadInfo(taskId: string): Promise<{ downloadUrl: string; filename: string; size: number; expiresIn: number }> {
    const response = await axios.get(`${API_BASE_URL}/tasks/download/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.data;
  }
}

export const taskService = new TaskService();