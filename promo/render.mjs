// Frame-exact render of promo/index.html: seek the master clock to each frame, screenshot, pipe to ffmpeg.
// Usage:
//   node render.mjs                      -> promo/build/video.mp4 (silent, 30 fps, 1920x1080)
//   node render.mjs --stills 1,8.9,20    -> promo/build/still-<t>.png for quick checks
// Needs Playwright (the project copy, else the global npm one) and ffmpeg on PATH.
// Uses an already-installed Chromium (PLAYWRIGHT_BROWSERS_PATH, default /opt/pw-browsers, or CHROME=...).
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

// playwright from the project, else from the global npm root
const req = createRequire(import.meta.url);
let pw;
try { pw = req("playwright"); } catch { pw = req(path.join(execSync("npm root -g").toString().trim(), "playwright")); }
const { chromium } = pw;

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "build");
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const stills = args.includes("--stills") ? args[args.indexOf("--stills") + 1].split(",").map(Number) : null;
const FPS = 30;

// Use Playwright's own browser if it is installed; otherwise any Chromium already in PLAYWRIGHT_BROWSERS_PATH
// (never downloads one). CHROME=/path/to/chrome overrides both.
let executablePath = process.env.CHROME;
if (!executablePath && !existsSync(chromium.executablePath())) {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const dir = existsSync(root) ? readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().pop() : null;
  if (dir) executablePath = path.join(root, dir, "chrome-linux", "chrome");
}
const browser = await chromium.launch({ executablePath, args: ["--force-color-profile=srgb", "--disable-gpu-vsync"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(pathToFileURL(path.join(here, "index.html")).href + "?capture=1");
await page.evaluate(() => window.READY);
const duration = await page.evaluate(() => window.DURATION);

async function grab(t, type = "jpeg") {
  await page.evaluate((t) => window.seek(t), t);
  return page.screenshot({ type, ...(type === "jpeg" ? { quality: 93 } : {}) });
}

if (stills) {
  for (const t of stills) {
    const buf = await grab(t, "png");
    const f = path.join(out, `still-${t.toFixed(2)}.png`);
    (await import("node:fs")).writeFileSync(f, buf);
    console.log(f);
  }
} else {
  const n = Math.round(duration * FPS);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(out, "video.mp4")], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await grab(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 150 === 0) console.log(`frame ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("wrote", path.join(out, "video.mp4"));
}
await browser.close();
