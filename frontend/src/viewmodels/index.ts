import { useState, useCallback, useEffect } from 'react';
import type { User, DbStats, SystemInfo } from '../models';

declare global {
  interface Window {
    getUsers?: () => void;
    getDbStats?: () => void;
    refreshUsers?: () => void;
    searchUsers?: () => void;
    Logger?: {
      info: (message: string, meta?: Record<string, unknown>) => void;
      warn: (message: string, meta?: Record<string, unknown>) => void;
      error: (message: string, meta?: Record<string, unknown>) => void;
      debug: (message: string, meta?: Record<string, unknown>) => void;
    };
  }
}

const Logger = window.Logger || {
  info: (msg: string, meta?: unknown) => console.log('[INFO]', msg, meta),
  warn: (msg: string, meta?: unknown) => console.warn('[WARN]', msg, meta),
  error: (msg: string, meta?: unknown) => console.error('[ERROR]', msg, meta),
  debug: (msg: string, meta?: unknown) => console.debug('[DEBUG]', msg, meta),
};

export interface UseCounterReturn {
  value: number;
  increment: () => void;
  reset: () => void;
  getValue: () => void;
}

export function useCounter(): UseCounterReturn {
  const [value, setValue] = useState(0);

  const increment = useCallback(() => {
    Logger.info('Incrementing counter');
    if (window.Logger) {
      // Call Rust backend
    }
    setValue(v => v + 1);
  }, []);

  const reset = useCallback(() => {
    Logger.info('Resetting counter');
    setValue(0);
  }, []);

  const getValue = useCallback(() => {
    Logger.info('Getting counter value');
  }, []);

  return { value, increment, reset, getValue };
}

export interface UseUsersReturn {
  users: User[];
  stats: DbStats | null;
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => void;
  fetchStats: () => void;
  refresh: () => void;
}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setIsLoading(true);
    setError(null);
    Logger.info('Fetching users from backend');
    
    import('../utils/event-bus').then(({ emit, EVENT_TYPES }) => {
      emit(EVENT_TYPES.CUSTOM, {
        event: 'get_users',
        source: 'frontend',
        reason: 'fetch_users'
      }, { source: 'useUsers_hook' });
    });

    if (window.getUsers) {
      window.getUsers();
    }
  }, []);

  const fetchStats = useCallback(() => {
    Logger.info('Fetching database stats');
    if (window.getDbStats) {
      window.getDbStats();
    }
  }, []);

  const refresh = useCallback(() => {
    fetchUsers();
    fetchStats();
  }, [fetchUsers, fetchStats]);

  useEffect(() => {
    const handleDbResponse = ((event: CustomEvent) => {
      const response = event.detail;
      if (response.success) {
        setUsers(response.data || []);
        Logger.info('Users loaded', { count: response.data?.length || 0 });
      } else {
        setError(response.error || 'Failed to load users');
        Logger.error('Failed to load users', { error: response.error });
      }
      setIsLoading(false);
    }) as EventListener;

    const handleStatsResponse = ((event: CustomEvent) => {
      const response = event.detail;
      if (response.success) {
        setStats(response.stats);
        Logger.info('Stats loaded', response.stats);
      }
    }) as EventListener;

    window.addEventListener('db_response', handleDbResponse);
    window.addEventListener('stats_response', handleStatsResponse);

    return () => {
      window.removeEventListener('db_response', handleDbResponse);
      window.removeEventListener('stats_response', handleStatsResponse);
    };
  }, []);

  return { users, stats, isLoading, error, fetchUsers, fetchStats, refresh };
}

export interface UseSystemInfoReturn {
  info: SystemInfo | null;
  isLoading: boolean;
  fetch: () => void;
}

export function useSystemInfo(): UseSystemInfoReturn {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(() => {
    setIsLoading(true);
    Logger.info('Fetching system info');
    
    import('../utils/event-bus').then(({ emit, EVENT_TYPES }) => {
      emit(EVENT_TYPES.CUSTOM, {
        event: 'get_system_info',
        source: 'frontend'
      }, { source: 'useSystemInfo_hook' });
    });
  }, []);

  return { info, isLoading, fetch };
}

export { Logger };
