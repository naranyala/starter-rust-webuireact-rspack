export interface SystemInfo {
  os: string;
  arch: string;
  family: string;
  browser: string;
  language: string;
}

export class SystemPlugin {
  private info: SystemInfo | null = null;

  getSystemInfo(): SystemInfo {
    if (!this.info) {
      this.info = {
        os: navigator.platform,
        arch: navigator.userAgent.includes('Win64') ? 'x64' : navigator.userAgent.includes('Linux x86_64') ? 'x64' : 'x86',
        family: navigator.userAgent.includes('Firefox') ? 'Firefox' : 
               navigator.userAgent.includes('Chrome') ? 'Chrome' : 
               navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown',
        browser: navigator.appName,
        language: navigator.language,
      };
    }
    return this.info;
  }

  static pluginName = 'system';
}

export const systemPlugin = new SystemPlugin();
