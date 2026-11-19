import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ayansh.fishingsimulator',
  appName: 'Ultimate Fishing Simulator 3D',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    backgroundColor: '#06131f'
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
