/**
 * How-to video pipeline. A storyboard is a list of steps; each has narration
 * and an optional Playwright action. For every step we synthesize speech,
 * perform the action on screen while it plays, and hold until the narration
 * finishes. Then ffmpeg lays the audio over the recording, compresses to 720p,
 * and a WebVTT caption file is written from the same timings.
 *
 * Output goes to howto-out/<slug>/ (git-ignored). Nothing is uploaded here.
 */
import { chromium, type Page, type BrowserContext } from "@playwright/test";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const ffmpeg = createRequire(__filename)("ffmpeg-static") as string;

export interface Step {
  say: string;
  run?: (page: Page) => Promise<void>;
}

export interface Storyboard {
  slug: string;
  title: string;
  /** Path to open first (after login). */
  startPath: string;
  steps: Step[];
  /** Always runs after recording, even on failure (delete demo data here). */
  cleanup?: (page: Page) => Promise<void>;
}

export interface RunOptions {
  baseUrl: string;
  /** Sign in with these credentials before recording (never shown on video). */
  login?: { email: string; password: string };
  voice?: string;
  outDir: string;
}

const PAUSE_AFTER_STEP = 0.7; // seconds of breathing room after each narration
const SIZE = { width: 1280, height: 720 };

function sh(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} failed:\n${r.stderr?.slice(-1500)}`);
  return r;
}

function durationOf(file: string): number {
  const r = spawnSync(ffmpeg, ["-i", file], { encoding: "utf8" });
  const m = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(r.stderr);
  if (!m) throw new Error(`Cannot read duration of ${file}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

const vttTime = (s: number) => {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
};

// A visible cursor and click ripple so viewers can follow the mouse.
const CURSOR_SCRIPT = `
(() => {
  if (window.__fnCursor) return; window.__fnCursor = true;
  const dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(242,169,60,.55);border:2px solid #b36b00;pointer-events:none;transition:transform .12s;left:-50px;top:-50px';
  const attach = () => document.documentElement.appendChild(dot);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', attach) : attach();
  addEventListener('mousemove', e => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { dot.style.transform = 'scale(.6)'; }, true);
  addEventListener('mouseup', () => { dot.style.transform = 'scale(1)'; }, true);
})();`;

/** Move the mouse to an element in a visible glide, then click it. */
export async function glideClick(page: Page, selector: string) {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  if (!box) throw new Error(`Not visible: ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.mouse.up();
}

/** Type at a readable speed into whatever is focused. */
export async function typeSlowly(page: Page, text: string, delay = 45) {
  await page.keyboard.type(text, { delay });
}

async function signIn(baseUrl: string, login: { email: string; password: string }, storagePath: string) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: baseUrl });
  const page = await ctx.newPage();
  await page.goto("/signin");
  await page.locator('input[type="email"], input[name="email"]').first().fill(login.email);
  await page.locator('input[type="password"]').first().fill(login.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 20000 });
  await ctx.storageState({ path: storagePath });
  await browser.close();
}

export async function produce(board: Storyboard, opts: RunOptions) {
  const out = path.join(opts.outDir, board.slug);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, "audio"), { recursive: true });

  // 1. Narration audio per step.
  const clips = board.steps.map((s, i) => {
    const file = path.join(out, "audio", `step-${String(i + 1).padStart(2, "0")}.aiff`);
    sh("say", ["-v", opts.voice ?? "Samantha", "-r", "170", "-o", file, s.say]);
    return { file, dur: durationOf(file) };
  });

  // 2. Sign in off-camera, then record.
  const storage = path.join(out, "storage-state.json");
  if (opts.login) await signIn(opts.baseUrl, opts.login, storage);

  const browser = await chromium.launch();
  const ctx: BrowserContext = await browser.newContext({
    baseURL: opts.baseUrl,
    viewport: SIZE,
    recordVideo: { dir: path.join(out, "raw"), size: SIZE },
    ...(opts.login ? { storageState: storage } : {}),
  });
  await ctx.addInitScript(CURSOR_SCRIPT);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const starts: number[] = [];
  let failure: unknown;

  try {
    await page.goto(board.startPath);
    await page.waitForTimeout(800);
    for (let i = 0; i < board.steps.length; i++) {
      starts.push(now());
      const end = now() + clips[i].dur + PAUSE_AFTER_STEP;
      await board.steps[i].run?.(page);
      const left = (end - now()) * 1000;
      if (left > 0) await page.waitForTimeout(left);
    }
    await page.waitForTimeout(600);
  } catch (e) {
    failure = e;
  } finally {
    try { await board.cleanup?.(page); } catch (e) { console.error("cleanup failed:", e); }
    const video = page.video();
    await ctx.close();
    await browser.close();
    if (failure) throw failure;

    // 3. Mix narration at each step's start time, mux, compress to 720p.
    const rawVideo = await video!.path();
    const inputs = clips.flatMap((c) => ["-i", c.file]);
    const delays = starts.map((s, i) => `[${i + 1}:a]adelay=${Math.round(s * 1000)}|${Math.round(s * 1000)}[a${i}]`);
    const mix = `${delays.join(";")};${starts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${starts.length}:normalize=0[aout]`;
    const mp4 = path.join(out, `${board.slug}.mp4`);
    sh(ffmpeg, [
      "-y", "-i", rawVideo, ...inputs, "-filter_complex", mix,
      "-map", "0:v", "-map", "[aout]",
      "-c:v", "libx264", "-crf", "28", "-preset", "medium", "-pix_fmt", "yuv420p",
      "-vf", "scale=1280:-2", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", mp4,
    ]);

    // 4. Captions and poster frame from the same timings.
    const total = durationOf(mp4);
    const cues = board.steps.map((s, i) => {
      const a = starts[i];
      const b = Math.min(a + clips[i].dur + 0.2, i + 1 < starts.length ? starts[i + 1] : total);
      return `${i + 1}\n${vttTime(a)} --> ${vttTime(b)}\n${s.say}\n`;
    });
    fs.writeFileSync(path.join(out, `${board.slug}.vtt`), `WEBVTT\n\n${cues.join("\n")}`);
    sh(ffmpeg, ["-y", "-ss", "2", "-i", mp4, "-frames:v", "1", path.join(out, `${board.slug}-poster.jpg`)]);

    const mb = (fs.statSync(mp4).size / 1048576).toFixed(1);
    console.log(`\nDone: ${mp4}\n  ${total.toFixed(0)}s, ${mb} MB\n  captions: ${board.slug}.vtt\n  poster:   ${board.slug}-poster.jpg`);
    return mp4;
  }
}
