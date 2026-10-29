/**
 * Offline check of the pipeline mechanics (speech, recording, mixing, captions)
 * against a local data: page. Touches no site, no database, no login.
 *   npx tsx scripts/howto/selftest.ts
 */
import { produce, glideClick, type Storyboard } from "./pipeline";
import path from "path";

const html = `<body style="font:28px sans-serif;padding:60px"><h1>Self-test page</h1>
<button id="b" style="font-size:28px;padding:14px 28px" onclick="document.getElementById('r').textContent='Clicked!'">Press me</button>
<p id="r" style="margin-top:30px;color:#1e5bae"></p></body>`;

const board: Storyboard = {
  slug: "selftest",
  title: "Pipeline self-test",
  startPath: "about:blank",
  steps: [
    { say: "This is a test of the how-to video pipeline.", run: async (p) => { await p.goto('data:text/html,' + encodeURIComponent(html)); } },
    { say: "The mouse glides to the button and clicks it.", run: async (p) => { await glideClick(p, "#b"); } },
    { say: "The page changed, so the recording and the voice are lined up." },
  ],
};

produce(board, { baseUrl: "http://localhost", outDir: path.join(process.cwd(), "howto-out") }).catch((e) => {
  console.error(e);
  process.exit(1);
});
