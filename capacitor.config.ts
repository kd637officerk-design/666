import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.symphonyno9.player',
  appName: 'Symphony No. 9',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#09090b',
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
