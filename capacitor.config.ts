import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // PLACEHOLDER: the application ID is permanent once uploaded to Google Play.
  // Choose the real one before the first Play upload (see docs/ANDROID.md).
  appId: "com.example.court",
  appName: "Court",
  webDir: "dist",
  android: {
    backgroundColor: "#14382b",
  },
};

export default config;
