import sanitizeHtml from "sanitize-html";

// Tight allowlist matching exactly what the Morning Boost rich-text editor
// (Tiptap StarterKit + Link) can actually produce — not a general-purpose
// sanitizer config.
//
// Uses `sanitize-html` (htmlparser2-based, no DOM) rather than
// isomorphic-dompurify: dompurify's jsdom fallback pulls in
// html-encoding-sniffer, which does a CommonJS require() of an ES module
// (@exodus/bytes) — that throws ERR_REQUIRE_ESM in Vercel's serverless
// runtime, crashing the route before the handler even runs.
//
// Pinned to sanitize-html@2.17.1 (package.json: exact, no ^) because 2.17.2+
// depends on htmlparser2 v10+, which is itself ESM-only ("type": "module")
// and hits the same ERR_REQUIRE_ESM crash one level down. 2.17.1 is the
// newest release still on htmlparser2 v8/v9 (plain CommonJS).
const ALLOWED_TAGS = ["p", "br", "strong", "em", "h2", "h3", "ul", "ol", "li", "blockquote", "a"];
const ALLOWED_ATTR = ["href", "target", "rel"];

export function sanitizeMorningBoostBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ALLOWED_ATTR },
  });
}
