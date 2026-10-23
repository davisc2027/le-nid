import path from "node:path";
import { defineConfig } from "@playwright/test";

const fixture = (name: string) => path.resolve("e2e/fixtures", name);
// Set PW_CHROMIUM_PATH to use an already-installed Chromium instead of the one `npx playwright install` fetches.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const fake = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"];
const project = (name: string, grep: RegExp, args: string[]) => ({ name, grep, use: { browserName: "chromium" as const, launchOptions: { executablePath, args } } });

export default defineConfig({
  testDir: "e2e",
  retries: 2, // Chromium loops the fake file, so a capture can start mid-phrase
  timeout: 30000,
  globalSetup: "./e2e/make-fixtures.mjs",
  webServer: { command: "npm run dev -- --port 3100", url: "http://localhost:3100/dev/speak", reuseExistingServer: true, timeout: 180000 },
  use: { baseURL: "http://localhost:3100" },
  projects: [
    project("speech", /@speech/, [...fake, `--use-file-for-fake-audio-capture=${fixture("speechlike.wav")}`]),
    project("rising", /@rising/, [...fake, `--use-file-for-fake-audio-capture=${fixture("rising.wav")}`]),
    project("falling", /@falling/, [...fake, `--use-file-for-fake-audio-capture=${fixture("falling.wav")}`]),
    project("silence", /@silence/, [...fake, `--use-file-for-fake-audio-capture=${fixture("silence.wav")}`]),
    project("denied", /@denied/, ["--use-fake-device-for-media-stream", "--deny-permission-prompts"]),
  ],
});
