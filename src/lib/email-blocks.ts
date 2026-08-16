export type BlockAlign = "left" | "center" | "right";

// ── Core layout blocks ───────────────────────────────────────────────────────

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
  utmSource?: string; utmMedium?: string; utmCampaign?: string;
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

// ── Generic layout / utility blocks ─────────────────────────────────────────

export interface ColumnsBlock {
  id: string; type: "columns";
  leftHtml: string; rightHtml: string;
  leftWeight: number; // 0.3 – 0.7; right = 1 - leftWeight
}
export interface SocialLinksBlock {
  id: string; type: "social_links";
  links: { platform: string; url: string }[];
  align: BlockAlign;
}
export interface LegalFooterBlock {
  id: string; type: "legal_footer";
  html: string;
}
export interface UnsubscribeBlock {
  id: string; type: "unsubscribe";
  text: string; align: BlockAlign;
}
export interface PersonalizationBlock {
  id: string; type: "personalization";
  variable: string;   // e.g. "{{first_name}}"
  fallback: string;
  label: string;      // preview label shown in composer
}

// ── Platform-specific dynamic blocks (data snapshotted at design time) ───────

export interface EventSnapshot {
  id: string; title: string; slug: string; coverUrl?: string;
  startsAt: string; location?: string; isVirtual: boolean;
  description?: string;
}
export interface EventCardBlock {
  id: string; type: "event_card";
  event: EventSnapshot | null;
  buttonLabel: string;
}

export interface BlogSnapshot {
  id: string; title: string; slug: string; imageUrl?: string;
  excerpt?: string; category?: string;
}
export interface BlogCardBlock {
  id: string; type: "blog_card";
  post: BlogSnapshot | null;
  buttonLabel: string;
}

export interface MorningBoostSnapshot {
  id: string; title: string; slug: string; imageUrl?: string; excerpt?: string;
}
export interface MorningBoostCardBlock {
  id: string; type: "morning_boost_card";
  boost: MorningBoostSnapshot | null;
  buttonLabel: string;
}

export interface ResourceSnapshot {
  id: string; title: string; slug: string; imageUrl?: string;
  excerpt?: string; type: string;
}
export interface ResourceCardBlock {
  id: string; type: "resource_card";
  resource: ResourceSnapshot | null;
  buttonLabel: string;
}

export interface ProductSnapshot {
  id: string; name: string; imageUrl?: string; description?: string;
}
export interface ProductCardBlock {
  id: string; type: "product_card";
  product: ProductSnapshot | null;
  buttonLabel: string;
}

export interface MembershipCtaBlock {
  id: string; type: "membership_cta";
  heading: string; body: string; buttonLabel: string; buttonHref: string;
  bgColor: string;
}
export interface ReferralCtaBlock {
  id: string; type: "referral_cta";
  heading: string; body: string; buttonLabel: string;
}

// ── Union type ───────────────────────────────────────────────────────────────

export type EmailBlock =
  | HeadingBlock | TextBlock | ButtonBlock
  | ImageBlock | DividerBlock | SpacerBlock | HtmlBlock
  | ColumnsBlock | SocialLinksBlock | LegalFooterBlock
  | UnsubscribeBlock | PersonalizationBlock
  | EventCardBlock | BlogCardBlock | MorningBoostCardBlock
  | ResourceCardBlock | ProductCardBlock
  | MembershipCtaBlock | ReferralCtaBlock;

export type EmailBlockType = EmailBlock["type"];

let _idSeq = 0;
export function newId() { return `blk_${++_idSeq}_${Math.random().toString(36).slice(2, 6)}`; }

export function defaultBlock(type: EmailBlockType): EmailBlock {
  switch (type) {
    case "heading":           return { id: newId(), type, text: "Heading", level: 1, align: "left", color: "#111827" };
    case "text":              return { id: newId(), type, html: "Add your text here." };
    case "button":            return { id: newId(), type, label: "Click here", href: "https://fixernation.org", bgColor: "#1e3a5f", textColor: "#ffffff", align: "center" };
    case "image":             return { id: newId(), type, src: "", alt: "", href: "", maxWidth: 560, align: "center" };
    case "divider":           return { id: newId(), type, color: "#e5e7eb", spacing: 16 };
    case "spacer":            return { id: newId(), type, height: 24 };
    case "html":              return { id: newId(), type, content: "<p>Custom HTML</p>" };
    case "columns":           return { id: newId(), type, leftHtml: "<p>Left column content.</p>", rightHtml: "<p>Right column content.</p>", leftWeight: 0.5 };
    case "social_links":      return { id: newId(), type, links: [{ platform: "facebook", url: "" }, { platform: "instagram", url: "" }], align: "center" };
    case "legal_footer":      return { id: newId(), type, html: "<p style='font-size:12px;color:#9ca3af;'>© 2026 Fixer Nation. All rights reserved.<br>Fixer Nation Issues and Answers, LLC.</p>" };
    case "unsubscribe":       return { id: newId(), type, text: "You're receiving this email because you're a Fixer Nation member. <a href='{{unsubscribe_url}}'>Unsubscribe</a>", align: "center" };
    case "personalization":   return { id: newId(), type, variable: "{{first_name}}", fallback: "there", label: "First name" };
    case "event_card":        return { id: newId(), type, event: null, buttonLabel: "View Event" };
    case "blog_card":         return { id: newId(), type, post: null, buttonLabel: "Read the Post" };
    case "morning_boost_card":return { id: newId(), type, boost: null, buttonLabel: "Read Today's Boost" };
    case "resource_card":     return { id: newId(), type, resource: null, buttonLabel: "Download" };
    case "product_card":      return { id: newId(), type, product: null, buttonLabel: "Learn More" };
    case "membership_cta":    return { id: newId(), type, heading: "Ready to Join?", body: "Become a Fixer Nation member and get full access to everything we offer.", buttonLabel: "Join Fixer Nation", buttonHref: "https://fixernation.org/join", bgColor: "#1e3a5f" };
    case "referral_cta":      return { id: newId(), type, heading: "Know someone who'd love this?", body: "Share your referral link and earn rewards when they join.", buttonLabel: "Get My Referral Link" };
  }
}

// ── HTML serializer ──────────────────────────────────────────────────────────

const BASE = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function alignStyle(a: BlockAlign) { return `text-align:${a};`; }

function buildUtmHref(href: string, b: ButtonBlock): string {
  if (!b.utmSource && !b.utmMedium && !b.utmCampaign) return href;
  try {
    const url = new URL(href);
    if (b.utmSource) url.searchParams.set("utm_source", b.utmSource);
    if (b.utmMedium) url.searchParams.set("utm_medium", b.utmMedium);
    if (b.utmCampaign) url.searchParams.set("utm_campaign", b.utmCampaign);
    return url.toString();
  } catch { return href; }
}

const SOCIAL_ICONS: Record<string, { label: string; color: string }> = {
  facebook:  { label: "Facebook",  color: "#1877F2" },
  instagram: { label: "Instagram", color: "#E4405F" },
  twitter:   { label: "X/Twitter", color: "#000000" },
  youtube:   { label: "YouTube",   color: "#FF0000" },
  linkedin:  { label: "LinkedIn",  color: "#0A66C2" },
  tiktok:    { label: "TikTok",    color: "#000000" },
};

function buttonHtml(label: string, href: string, bgColor: string, textColor: string, align: BlockAlign): string {
  const tAlign = align === "center" ? "margin:0 auto;" : align === "right" ? "margin:0 0 0 auto;" : "margin:0;";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tAlign}margin-bottom:24px;border-collapse:collapse;"><tr><td style="background:${bgColor};border-radius:8px;"><a href="${escAttr(href)}" target="_blank" style="display:inline-block;padding:12px 28px;${BASE};font-size:15px;font-weight:600;color:${textColor};text-decoration:none;">${escHtml(label)}</a></td></tr></table>`;
}

function blockHtml(b: EmailBlock): string {
  switch (b.type) {
    case "heading": {
      const sizes: Record<number, string> = { 1: "28px", 2: "22px", 3: "18px" };
      const weights: Record<number, string> = { 1: "700", 2: "700", 3: "600" };
      const margins: Record<number, string> = { 1: "0 0 16px", 2: "0 0 12px", 3: "0 0 10px" };
      return `<h${b.level} style="margin:${margins[b.level]};${BASE};font-size:${sizes[b.level]};font-weight:${weights[b.level]};color:${b.color};${alignStyle(b.align)}line-height:1.3;">${escHtml(b.text)}</h${b.level}>`;
    }
    case "text":
      return `<div style="margin:0 0 16px;${BASE};font-size:16px;line-height:1.7;color:#374151;">${b.html}</div>`;
    case "button":
      return buttonHtml(b.label, buildUtmHref(b.href, b), b.bgColor, b.textColor, b.align);
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

    case "columns": {
      const lw = Math.round(b.leftWeight * 100);
      const rw = 100 - lw;
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 16px;"><tr><td valign="top" width="${lw}%" style="padding-right:12px;${BASE};font-size:15px;line-height:1.6;color:#374151;">${b.leftHtml}</td><td valign="top" width="${rw}%" style="padding-left:12px;${BASE};font-size:15px;line-height:1.6;color:#374151;">${b.rightHtml}</td></tr></table>`;
    }
    case "social_links": {
      const cells = b.links.filter(l => l.url).map(l => {
        const meta = SOCIAL_ICONS[l.platform] ?? { label: l.platform, color: "#6b7280" };
        return `<td style="padding:0 6px;"><a href="${escAttr(l.url)}" target="_blank" style="${BASE};font-size:13px;font-weight:600;color:${meta.color};text-decoration:none;">${escHtml(meta.label)}</a></td>`;
      }).join("");
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;${b.align === "center" ? "margin-left:auto;margin-right:auto;" : b.align === "right" ? "margin-left:auto;" : ""}border-collapse:collapse;"><tr>${cells}</tr></table>`;
    }
    case "legal_footer":
      return `<div style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;${BASE};font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;">${b.html}</div>`;
    case "unsubscribe":
      return `<div style="margin:16px 0;${BASE};font-size:13px;line-height:1.6;color:#9ca3af;${alignStyle(b.align)}">${b.text}</div>`;
    case "personalization":
      return `<span style="${BASE};color:#374151;">${escHtml(b.variable)}</span>`;

    case "event_card": {
      if (!b.event) return `<div style="padding:16px;border:1px dashed #d1d5db;border-radius:8px;text-align:center;color:#9ca3af;${BASE};font-size:14px;">No event selected</div>`;
      const e = b.event;
      const date = new Date(e.startsAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      const cover = e.coverUrl ? `<img src="${escAttr(e.coverUrl)}" alt="${escAttr(e.title)}" style="display:block;width:100%;max-height:220px;object-fit:cover;border-radius:8px 8px 0 0;" />` : "";
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;margin:0 0 20px;overflow:hidden;"><tr><td>${cover}<div style="padding:20px;"><p style="margin:0 0 4px;${BASE};font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${e.isVirtual ? "Virtual Event" : escHtml(e.location ?? "Event")}</p><h3 style="margin:0 0 8px;${BASE};font-size:20px;font-weight:700;color:#111827;line-height:1.3;">${escHtml(e.title)}</h3><p style="margin:0 0 16px;${BASE};font-size:14px;color:#6b7280;">${date}</p>${e.description ? `<p style="margin:0 0 16px;${BASE};font-size:15px;color:#374151;line-height:1.6;">${escHtml(e.description.slice(0, 200))}${e.description.length > 200 ? "…" : ""}</p>` : ""}${buttonHtml(b.buttonLabel, `https://fixernation.org/events/${e.slug}`, "#1e3a5f", "#ffffff", "left")}</div></td></tr></table>`;
    }
    case "blog_card": {
      if (!b.post) return `<div style="padding:16px;border:1px dashed #d1d5db;border-radius:8px;text-align:center;color:#9ca3af;${BASE};font-size:14px;">No post selected</div>`;
      const p = b.post;
      const cover = p.imageUrl ? `<img src="${escAttr(p.imageUrl)}" alt="${escAttr(p.title)}" style="display:block;width:100%;max-height:200px;object-fit:cover;border-radius:8px 8px 0 0;" />` : "";
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;margin:0 0 20px;overflow:hidden;"><tr><td>${cover}<div style="padding:20px;">${p.category ? `<p style="margin:0 0 4px;${BASE};font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">${escHtml(p.category)}</p>` : ""}<h3 style="margin:0 0 8px;${BASE};font-size:20px;font-weight:700;color:#111827;line-height:1.3;">${escHtml(p.title)}</h3>${p.excerpt ? `<p style="margin:0 0 16px;${BASE};font-size:15px;color:#374151;line-height:1.6;">${escHtml(p.excerpt)}</p>` : ""}${buttonHtml(b.buttonLabel, `https://fixernation.org/blog/${p.slug}`, "#1e3a5f", "#ffffff", "left")}</div></td></tr></table>`;
    }
    case "morning_boost_card": {
      if (!b.boost) return `<div style="padding:16px;border:1px dashed #d1d5db;border-radius:8px;text-align:center;color:#9ca3af;${BASE};font-size:14px;">No Morning Boost selected</div>`;
      const mb = b.boost;
      const cover = mb.imageUrl ? `<img src="${escAttr(mb.imageUrl)}" alt="${escAttr(mb.title)}" style="display:block;width:100%;max-height:200px;object-fit:cover;border-radius:8px 8px 0 0;" />` : "";
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin:0 0 20px;overflow:hidden;"><tr><td>${cover}<div style="padding:20px;"><p style="margin:0 0 4px;${BASE};font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;">Morning Boost</p><h3 style="margin:0 0 8px;${BASE};font-size:20px;font-weight:700;color:#111827;line-height:1.3;">${escHtml(mb.title)}</h3>${mb.excerpt ? `<p style="margin:0 0 16px;${BASE};font-size:15px;color:#374151;line-height:1.6;">${escHtml(mb.excerpt)}</p>` : ""}${buttonHtml(b.buttonLabel, `https://fixernation.org/morning-boost/${mb.slug}`, "#d97706", "#ffffff", "left")}</div></td></tr></table>`;
    }
    case "resource_card": {
      if (!b.resource) return `<div style="padding:16px;border:1px dashed #d1d5db;border-radius:8px;text-align:center;color:#9ca3af;${BASE};font-size:14px;">No resource selected</div>`;
      const r = b.resource;
      const cover = r.imageUrl ? `<img src="${escAttr(r.imageUrl)}" alt="${escAttr(r.title)}" style="display:block;width:100%;max-height:180px;object-fit:cover;border-radius:8px 8px 0 0;" />` : "";
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;margin:0 0 20px;overflow:hidden;"><tr><td>${cover}<div style="padding:20px;"><p style="margin:0 0 4px;${BASE};font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">${escHtml(r.type)}</p><h3 style="margin:0 0 8px;${BASE};font-size:20px;font-weight:700;color:#111827;">${escHtml(r.title)}</h3>${r.excerpt ? `<p style="margin:0 0 16px;${BASE};font-size:15px;color:#374151;line-height:1.6;">${escHtml(r.excerpt)}</p>` : ""}${buttonHtml(b.buttonLabel, `https://fixernation.org/resources/${r.slug}`, "#1e3a5f", "#ffffff", "left")}</div></td></tr></table>`;
    }
    case "product_card": {
      if (!b.product) return `<div style="padding:16px;border:1px dashed #d1d5db;border-radius:8px;text-align:center;color:#9ca3af;${BASE};font-size:14px;">No product selected</div>`;
      const pr = b.product;
      const cover = pr.imageUrl ? `<img src="${escAttr(pr.imageUrl)}" alt="${escAttr(pr.name)}" style="display:block;width:100%;max-height:180px;object-fit:cover;border-radius:8px 8px 0 0;" />` : "";
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;margin:0 0 20px;overflow:hidden;"><tr><td>${cover}<div style="padding:20px;"><h3 style="margin:0 0 8px;${BASE};font-size:20px;font-weight:700;color:#111827;">${escHtml(pr.name)}</h3>${pr.description ? `<p style="margin:0 0 16px;${BASE};font-size:15px;color:#374151;line-height:1.6;">${escHtml(pr.description.slice(0, 180))}${pr.description.length > 180 ? "…" : ""}</p>` : ""}${buttonHtml(b.buttonLabel, `https://fixernation.org/books`, "#1e3a5f", "#ffffff", "left")}</div></td></tr></table>`;
    }
    case "membership_cta": {
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:${b.bgColor};border-radius:12px;margin:0 0 24px;"><tr><td style="padding:32px 28px;text-align:center;"><h2 style="margin:0 0 12px;${BASE};font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">${escHtml(b.heading)}</h2><p style="margin:0 0 24px;${BASE};font-size:16px;color:rgba(255,255,255,0.85);line-height:1.6;">${escHtml(b.body)}</p>${buttonHtml(b.buttonLabel, b.buttonHref, "#ffffff", b.bgColor, "center")}</td></tr></table>`;
    }
    case "referral_cta": {
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin:0 0 24px;"><tr><td style="padding:28px;text-align:center;"><h2 style="margin:0 0 10px;${BASE};font-size:22px;font-weight:700;color:#14532d;line-height:1.3;">${escHtml(b.heading)}</h2><p style="margin:0 0 20px;${BASE};font-size:15px;color:#166534;line-height:1.6;">${escHtml(b.body)}</p>${buttonHtml(b.buttonLabel, "{{referral_url}}", "#16a34a", "#ffffff", "center")}</td></tr></table>`;
    }
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
