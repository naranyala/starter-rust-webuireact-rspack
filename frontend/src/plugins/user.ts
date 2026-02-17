export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export class UserPlugin {
  private users: User[] = [];
  private listeners: Array<(users: User[]) => void> = [];

  setUsers(users: User[]): void {
    this.users = users;
    this.notifyListeners();
  }

  getUsers(): User[] {
    return this.users;
  }

  addUser(user: User): void {
    this.users = [...this.users, user];
    this.notifyListeners();
  }

  updateUser(id: number, updates: Partial<User>): void {
    this.users = this.users.map(u => u.id === id ? { ...u, ...updates } : u);
    this.notifyListeners();
  }

  deleteUser(id: number): void {
    this.users = this.users.filter(u => u.id !== id);
    this.notifyListeners();
  }

  subscribe(listener: (users: User[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.users);
    }
  }

  static pluginName = 'user';
}

export const userPlugin = new UserPlugin();
