export type BlockAlign = "left" | "center" | "right";

export interface HeadingBlock {
  id: string; type: "heading";
  text: string; level: 1 | 2 | 3; align: BlockAlign; color: string;
}
export interface TextBlock {
  id: string; type: "text";
  html: string;
}
export interface ButtonBlock {
  id: string; type: "button";
  label: string; href: string; bgColor: string; textColor: string; align: BlockAlign;
}
export interface ImageBlock {
  id: string; type: "image";
  src: string; alt: string; href: string; maxWidth: number; align: BlockAlign;
}
export interface DividerBlock {
  id: string; type: "divider"; color: string; spacing: number;
}
export interface SpacerBlock {
  id: string; type: "spacer"; height: number;
}
export interface HtmlBlock {
  id: string; type: "html"; content: string;
}

export type EmailBlock =
  | HeadingBlock | TextBlock | ButtonBlock
  | ImageBlock | DividerBlock | SpacerBlock | HtmlBlock;

export type EmailBlockType = EmailBlock["type"];

let _idSeq = 0;
export function newId() { return `blk_${++_idSeq}_${Math.random().toString(36).slice(2, 6)}`; }

export function defaultBlock(type: EmailBlockType): EmailBlock {
  switch (type) {
    case "heading":  return { id: newId(), type, text: "Heading", level: 1, align: "left", color: "#111827" };
    case "text":     return { id: newId(), type, html: "Add your text here." };
    case "button":   return { id: newId(), type, label: "Click here", href: "https://fixernation.org", bgColor: "#1e3a5f", textColor: "#ffffff", align: "center" };
    case "image":    return { id: newId(), type, src: "", alt: "", href: "", maxWidth: 560, align: "center" };
    case "divider":  return { id: newId(), type, color: "#e5e7eb", spacing: 16 };
    case "spacer":   return { id: newId(), type, height: 24 };
    case "html":     return { id: newId(), type, content: "<p>Custom HTML</p>" };
  }
}

// ── HTML serializer ──────────────────────────────────────────────────────────

const BASE = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function align(a: BlockAlign) {
  return `text-align:${a};`;
}

function blockHtml(b: EmailBlock): string {
  switch (b.type) {
    case "heading": {
      const sizes: Record<number, string> = { 1: "28px", 2: "22px", 3: "18px" };
      const weights: Record<number, string> = { 1: "700", 2: "700", 3: "600" };
      const margins: Record<number, string> = { 1: "0 0 16px", 2: "0 0 12px", 3: "0 0 10px" };
      return `<h${b.level} style="margin:${margins[b.level]};${BASE};font-size:${sizes[b.level]};font-weight:${weights[b.level]};color:${b.color};${align(b.align)}line-height:1.3;">${escHtml(b.text)}</h${b.level}>`;
    }
    case "text":
      return `<div style="margin:0 0 16px;${BASE};font-size:16px;line-height:1.7;color:#374151;">${b.html}</div>`;
    case "button": {
      const tAlign = b.align === "center" ? "margin:0 auto;" : b.align === "right" ? "margin:0 0 0 auto;" : "margin:0;";
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tAlign}margin-bottom:24px;border-collapse:collapse;"><tr><td style="background:${b.bgColor};border-radius:8px;"><a href="${escAttr(b.href)}" target="_blank" style="display:inline-block;padding:12px 28px;${BASE};font-size:15px;font-weight:600;color:${b.textColor};text-decoration:none;">${escHtml(b.label)}</a></td></tr></table>`;
    }
    case "image": {
      const imgStyle = `display:block;max-width:${b.maxWidth}px;width:100%;height:auto;${b.align === "center" ? "margin:0 auto 16px;" : b.align === "right" ? "margin:0 0 16px auto;" : "margin:0 0 16px;"}`;
      const img = `<img src="${escAttr(b.src)}" alt="${escAttr(b.alt)}" style="${imgStyle}" />`;
      return b.href ? `<a href="${escAttr(b.href)}" target="_blank" style="display:block;">${img}</a>` : img;
    }
    case "divider":
      return `<hr style="border:none;border-top:1px solid ${b.color};margin:${b.spacing}px 0;" />`;
    case "spacer":
      return `<div style="height:${b.height}px;line-height:${b.height}px;font-size:1px;">&nbsp;</div>`;
    case "html":
      return b.content;
  }
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  if (blocks.length === 0) return "";
  return blocks.map(blockHtml).join("\n");
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s: string) {
  return s.replace(/"/g, "&quot;");
}
