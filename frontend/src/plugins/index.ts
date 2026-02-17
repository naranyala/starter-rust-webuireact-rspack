export * from './counter';
export * from './user';
export * from './system';
export * from './window';

export interface Plugin {
  name: string;
}

export const pluginRegistry = {
  counter: { name: 'counter', initialized: false },
  user: { name: 'user', initialized: false },
  system: { name: 'system', initialized: false },
  window: { name: 'window', initialized: false },
};

export function initializePlugins(): void {
  console.log('Initializing plugins:', Object.keys(pluginRegistry));
  for (const [key, plugin] of Object.entries(pluginRegistry)) {
    console.log(`Plugin ${plugin.name} ready`);
    plugin.initialized = true;
  }
}
