export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface DbStats {
  users: number;
  tables: string[];
  size: string;
}

export interface SystemInfo {
  cpu: string;
  memory: string;
  os: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
}

export interface CounterState {
  value: number;
}

export interface AppConfig {
  app: {
    name: string;
    version: string;
  };
  database: {
    path: string;
    create_sample_data: boolean;
  };
  window: {
    title: string;
  };
  logging: {
    level: string;
    file: string;
    append: boolean;
  };
}
