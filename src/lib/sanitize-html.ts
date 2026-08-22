import DOMPurify from "isomorphic-dompurify";

// Tight allowlist matching exactly what the Morning Boost rich-text editor
// (Tiptap StarterKit + Link) can actually produce — not a general-purpose
// sanitizer config.
const ALLOWED_TAGS = ["p", "br", "strong", "em", "h2", "h3", "ul", "ol", "li", "blockquote", "a"];
const ALLOWED_ATTR = ["href", "target", "rel"];

export function sanitizeMorningBoostBody(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
