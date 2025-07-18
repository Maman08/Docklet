import axios from 'axios';
import { Task, TaskSubmission, TaskType } from '../types';

const API_BASE_URL = 'http://localhost:3000/api';

class TaskService {
  async submitTask(submission: TaskSubmission): Promise<{ taskId: string }> {
    const formData = new FormData();
    formData.append('file', submission.file);
    formData.append('type', submission.type);
    formData.append('parameters', JSON.stringify(submission.parameters));

    const response = await axios.post(`${API_BASE_URL}/tasks/submit`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getTaskStatus(taskId: string): Promise<Task> {
    const response = await axios.get(`${API_BASE_URL}/tasks/status/${taskId}`);
    return response.data;
  }

  async downloadFile(taskId: string): Promise<Blob> {
    const response = await axios.get(`${API_BASE_URL}/tasks/download/${taskId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async getUserTasks(userId: string): Promise<Task[]> {
    const response = await axios.get(`${API_BASE_URL}/tasks/profile/${userId}`);
    return Array.isArray(response.data)
    ? response.data
    : response.data.tasks || [];
  }

  getDownloadUrl(taskId: string): string {
    return `${API_BASE_URL}/tasks/download/${taskId}`;
  }
}

export const taskService = new TaskService();















