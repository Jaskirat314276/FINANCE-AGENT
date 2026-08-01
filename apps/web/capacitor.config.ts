import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor native shell — bundles the built web app (dist/) INSIDE the
 * binary, so the UI loads from the device (true app feel, works offline for
 * the shell). Only API calls leave the app, to the Render backend.
 *
 * NOTE: the WebView origin is https://localhost — that origin must be present
 * in the API's CORS_ORIGIN list (comma-separated) or logins will fail.
 * Build flow: npm run native:android  →  open android/ in Android Studio.
 */
const config: CapacitorConfig = {
  appId: 'com.seekerai.app',
  appName: 'Seeker',
  webDir: 'dist',
  backgroundColor: '#0b1121',
  android: {
    allowMixedContent: false,
  },
};

export default config;
