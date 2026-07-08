import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * 환경변수 VITE_API_BASE_URL (기본값: http://localhost:8000)
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30초 타임아웃
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: 필요한 경우 인증 토큰이나 공통 헤더 추가
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 로깅 또는 추가 검증 로직을 나중에 확장 가능
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: 공통 에러 핸들링
client.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // 백엔드 Proxy 또는 로컬 Ubuntu AF3 서버 통신 실패 시 공통 에러 로깅
    console.error('[API Communication Error]:', error.message || 'Unknown network error');
    return Promise.reject(error);
  }
);

export default client;
