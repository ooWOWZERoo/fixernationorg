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

// Blog posts: everything the blog editor (TipTap StarterKit + Underline +
// Link + Image + TextAlign) can produce. Same sanitize-html constraints as
// above. Images must be https; text-align is the only inline style allowed.
const BLOG_ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "h2", "h3", "h4", "ul", "ol", "li",
  "blockquote", "a", "hr", "img", "code", "pre",
];

export function sanitizeBlogBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: BLOG_ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedStyles: {
      "*": { "text-align": [/^(left|center|right|justify)$/] },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https"] },
    // Drop images whose src was stripped (non-https) rather than leave a bare <img>.
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });
}

// Plain text of the first paragraph, for the blurred preview shown to
// non-members (they never receive the full post HTML).
export function blogPreviewText(html: string): string {
  const firstBlock = html.split(/<\/(?:p|h2|h3|h4|li|blockquote)>/i).find((chunk) => chunk.replace(/<[^>]*>/g, "").trim()) ?? "";
  return sanitizeHtml(firstBlock, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}
