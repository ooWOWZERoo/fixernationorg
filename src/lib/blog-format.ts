// Blog post bodies come in two formats, told apart by a marker the admin
// editor prepends on save:
//   - Legacy: plain text; paragraphs are separated by blank lines and the
//     public page renders each as a <p>. Every post written before the rich
//     editor is in this format and keeps rendering the same way.
//   - HTML: sanitized rich-text HTML from the TipTap editor, stored after the
//     marker. The marker is an HTML comment, so it can never collide with
//     legacy text in practice.
export const BLOG_HTML_MARKER = "<!--fn:html-->";

export function isBlogHtml(body: string): boolean {
  return body.startsWith(BLOG_HTML_MARKER);
}

export function stripBlogHtmlMarker(body: string): string {
  return isBlogHtml(body) ? body.slice(BLOG_HTML_MARKER.length) : body;
}

// Some older plain-text posts were written with real HTML tags in the body
// (e.g. "<p>...</p>\n\n<h2>...</h2>"). The old page showed those tags as
// literal text. Treat a body that opens with a block tag as HTML.
export function looksLikeHtml(body: string): boolean {
  return /^\s*<(p|h[1-6]|ul|ol|blockquote|div)\b/i.test(body);
}

// True for any body that should be rendered as (sanitized) HTML.
export function isHtmlBody(body: string): boolean {
  return isBlogHtml(body) || looksLikeHtml(body);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Mirrors how the public page renders a legacy body: split on blank lines,
// one <p> each, with single newlines collapsing to a space (as HTML does).
// Lets the editor open an old post looking the way it looks today.
export function legacyBodyToHtml(body: string): string {
  if (looksLikeHtml(body)) return body;
  return body
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\s*\n\s*/g, " ")}</p>`)
    .join("");
}

// True when the editor's HTML has no text and no image (e.g. "<p></p>").
export function isBlogHtmlEmpty(html: string): boolean {
  if (/<img\b/i.test(html) || /<hr\b/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}
