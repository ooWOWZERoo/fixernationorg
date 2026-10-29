/**
 * How-to video: writing a blog post in /admin/blog/new.
 *
 *   HOWTO_BASE_URL=https://staging.example.com \
 *   HOWTO_EMAIL=demo-admin@... HOWTO_PASSWORD=... \
 *   npx tsx scripts/howto/blog-editor.ts
 *
 * Creates ONE unpublished demo post (slug starts with "demo-how-to-") and
 * deletes it afterward. The image step uploads a small generated picture to
 * Cloudinary; that asset is left behind. Output: howto-out/blog-editor/.
 */
import { spawnSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { produce, glideClick, typeSlowly, type Storyboard } from "./pipeline";

const ffmpeg = createRequire(__filename)("ffmpeg-static") as string;
const baseUrl = process.env.HOWTO_BASE_URL;
const email = process.env.HOWTO_EMAIL;
const password = process.env.HOWTO_PASSWORD;

if (!baseUrl || !email || !password) {
  console.error("Set HOWTO_BASE_URL, HOWTO_EMAIL and HOWTO_PASSWORD.");
  process.exit(1);
}
// This site has one database and it is production: recording creates real
// rows. Require an explicit opt-in so it never happens by accident.
if (/(^|\/\/)(www\.)?fixernation\.org/.test(baseUrl) && process.env.HOWTO_ALLOW_PROD !== "1") {
  console.error("Refusing to record against production. Set HOWTO_ALLOW_PROD=1 to confirm a demo admin account is used.");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "howto-out");
fs.mkdirSync(outDir, { recursive: true });
const image = path.join(outDir, "demo-image.png");
spawnSync(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=0x1e5bae:s=800x450", "-frames:v", "1", image]);

const TITLE = "Demo: how to write a blog post";
const bar = (label: string) => `button[aria-label="${label}"]`;
let postId = "";

const board: Storyboard = {
  slug: "blog-editor",
  title: "Writing a blog post",
  startPath: "/admin/blog",
  steps: [
    {
      say: "This is how you write a blog post in the Fixer Nation admin. From the Blog page, choose New Post.",
      run: async (p) => { await glideClick(p, 'a[href="/admin/blog/new"]'); await p.waitForURL("**/admin/blog/new"); },
    },
    {
      say: "Start with a title. The slug, which is the end of the web address, fills in for you. You can change it if you want something shorter.",
      run: async (p) => { await glideClick(p, "#title"); await typeSlowly(p, TITLE); },
    },
    {
      say: "Add a category, and a one or two line excerpt. That's the text people see on the blog index.",
      run: async (p) => {
        await glideClick(p, "#category"); await typeSlowly(p, "Mindset");
        await glideClick(p, "#excerpt"); await typeSlowly(p, "A short walkthrough of the new blog editor.");
      },
    },
    {
      say: "The body works like a word processor. What you see here uses the same spacing as the published page.",
      run: async (p) => { await glideClick(p, ".ProseMirror"); await typeSlowly(p, "Why a good headline matters"); },
    },
    {
      say: "Use the heading buttons for section titles, and bold or italic for emphasis.",
      run: async (p) => {
        await glideClick(p, bar("Heading 2"));
        await p.keyboard.press("Enter");
        await typeSlowly(p, "Readers decide in seconds, so lead with the ");
        await glideClick(p, bar("Bold"));
        await typeSlowly(p, "most useful idea");
        await glideClick(p, bar("Bold"));
        await typeSlowly(p, ".");
        await p.keyboard.press("Enter");
      },
    },
    {
      say: "Lists, quotes and divider lines are one click each.",
      run: async (p) => {
        await glideClick(p, bar("Bullet list"));
        await typeSlowly(p, "Keep sentences short"); await p.keyboard.press("Enter");
        await typeSlowly(p, "Say one thing per paragraph"); await p.keyboard.press("Enter");
        await p.keyboard.press("Enter");
      },
    },
    {
      say: "To add a link, highlight the words, click Link, and enter the address when asked.",
      run: async (p) => {
        await typeSlowly(p, "Read more on our site");
        await p.keyboard.press("Shift+Home");
        await glideClick(p, bar("Link"));
        await p.keyboard.press("End");
        await p.keyboard.press("Enter");
      },
    },
    {
      say: "Click Image to upload a picture. It goes straight into the post.",
      run: async (p) => {
        const [chooser] = await Promise.all([p.waitForEvent("filechooser"), glideClick(p, bar("Insert image"))]);
        await chooser.setFiles(image);
        await p.locator(".ProseMirror img").first().waitFor({ timeout: 30000 });
      },
    },
    {
      say: "The alignment buttons let you center or justify text.",
      run: async (p) => { await glideClick(p, ".ProseMirror h2"); await glideClick(p, bar("Align center")); },
    },
    {
      say: "Leave the publish date blank to save a draft. Nothing goes live until you set a date. Click Create Post.",
      run: async (p) => {
        await glideClick(p, 'button[type="submit"]');
        await p.waitForURL(/\/admin\/blog\/(?!new)[^/]+$/, { timeout: 30000 });
        postId = p.url().split("/").pop()!;
        await p.waitForSelector("text=Saved", { state: "detached", timeout: 1000 }).catch(() => {});
      },
    },
    {
      say: "Your draft is saved. Click Preview draft to see it exactly as readers will. The spacing matches what you just saw in the editor.",
      run: async (p) => {
        const href = await p.locator('a:has-text("Preview draft")').first().getAttribute("href");
        await glideClick(p, 'a:has-text("Preview draft")');
        await p.goto(href!); // the link opens a new tab; show it in this one
        await p.waitForSelector(".blog-content");
        await p.mouse.wheel(0, 300);
      },
    },
    {
      say: "Come back any time to keep editing, then add a publish date when it's ready.",
      run: async (p) => { await p.goto("/admin/blog"); },
    },
  ],
  cleanup: async (p) => {
    if (!postId) return;
    const res = await p.request.delete(`/api/admin/blog/${postId}`);
    console.log(`cleanup: demo post ${postId} delete -> ${res.status()}`);
  },
};

// Native prompts (link URL, image alt text) are answered automatically; they
// are not part of the page, so they do not appear in the recording.
const withDialogs: Storyboard = {
  ...board,
  steps: board.steps.map((s, i) =>
    i === 0 ? { ...s, run: async (p) => {
      p.on("dialog", (d) => d.accept(d.message().startsWith("Link") ? "https://fixernation.org" : "Demo image"));
      await s.run!(p);
    } } : s),
};

produce(withDialogs, { baseUrl, login: { email, password }, outDir }).catch((e) => {
  console.error(e);
  process.exit(1);
});
