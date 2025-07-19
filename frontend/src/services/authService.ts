import axios from 'axios';
import { User, AuthResponse, LoginCredentials, RegisterCredentials } from '../types';

const API_BASE_URL = 'https://api.docklet.site/api';
// const API_BASE_URL = 'http://localhost:3000/api';

class AuthService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
    return response.data;
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, credentials);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await axios.get(`${API_BASE_URL}/auth/me`);
    return response.data;
  }

  async logout(): Promise<void> {
    await axios.post(`${API_BASE_URL}/auth/logout`);
  }
}

export const authService = new AuthService();