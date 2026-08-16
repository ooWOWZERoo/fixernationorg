"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  type EmailBlock, type EmailBlockType, type BlockAlign,
  type HeadingBlock, type TextBlock, type ButtonBlock,
  type ImageBlock, type DividerBlock, type SpacerBlock, type HtmlBlock,
  type ColumnsBlock, type SocialLinksBlock, type LegalFooterBlock,
  type UnsubscribeBlock, type PersonalizationBlock,
  type EventCardBlock, type BlogCardBlock, type MorningBoostCardBlock,
  type ResourceCardBlock, type ProductCardBlock,
  type MembershipCtaBlock, type ReferralCtaBlock,
  type EventSnapshot, type BlogSnapshot, type MorningBoostSnapshot,
  type ResourceSnapshot, type ProductSnapshot,
  defaultBlock, blocksToHtml, newId,
} from "@/lib/email-blocks";

interface SavedSectionRow { id: string; name: string; blocks: unknown }

interface ValidationIssue { blockId: string; message: string }

interface Props {
  initialBlocks?: EmailBlock[];
  onChange: (html: string, blocks: EmailBlock[]) => void;
  onPickImage?: (cb: (url: string) => void) => void;
  autosaveKey?: string;
}

const PALETTE_GROUPS: { label: string; items: { type: EmailBlockType; label: string }[] }[] = [
  {
    label: "Content",
    items: [
      { type: "heading",  label: "Heading" },
      { type: "text",     label: "Text" },
      { type: "button",   label: "Button" },
      { type: "image",    label: "Image" },
    ],
  },
  {
    label: "Layout",
    items: [
      { type: "columns",     label: "2 Columns" },
      { type: "divider",     label: "Divider" },
      { type: "spacer",      label: "Spacer" },
      { type: "html",        label: "HTML" },
    ],
  },
  {
    label: "Platform",
    items: [
      { type: "event_card",         label: "Event" },
      { type: "blog_card",          label: "Blog post" },
      { type: "morning_boost_card", label: "Morning Boost" },
      { type: "resource_card",      label: "Resource" },
      { type: "product_card",       label: "Product" },
      { type: "membership_cta",     label: "Membership CTA" },
      { type: "referral_cta",       label: "Referral CTA" },
    ],
  },
  {
    label: "Utility",
    items: [
      { type: "social_links",    label: "Social links" },
      { type: "personalization", label: "Personalization" },
      { type: "unsubscribe",     label: "Unsubscribe" },
      { type: "legal_footer",    label: "Legal footer" },
    ],
  },
];

const TYPE_LABELS: Record<EmailBlockType, string> = {
  heading: "Heading", text: "Text", button: "Button", image: "Image",
  divider: "Divider", spacer: "Spacer", html: "HTML",
  columns: "2 Columns", social_links: "Social links", legal_footer: "Legal footer",
  unsubscribe: "Unsubscribe", personalization: "Personalization",
  event_card: "Event", blog_card: "Blog post", morning_boost_card: "Morning Boost",
  resource_card: "Resource", product_card: "Product",
  membership_cta: "Membership CTA", referral_cta: "Referral CTA",
};

function blockSummary(b: EmailBlock): string {
  switch (b.type) {
    case "heading":           return b.text.slice(0, 60) || "(empty)";
    case "text":              return b.html.replace(/<[^>]+>/g, "").slice(0, 60) || "(empty)";
    case "button":            return b.label || "(no label)";
    case "image":             return b.src ? b.src.split("/").pop() ?? b.src : "(no image)";
    case "divider":           return `${b.spacing}px spacing`;
    case "spacer":            return `${b.height}px height`;
    case "html":              return b.content.replace(/<[^>]+>/g, "").slice(0, 60) || "(empty)";
    case "columns":           return "Two-column layout";
    case "social_links":      return `${b.links.filter(l => l.url).length} link(s)`;
    case "legal_footer":      return "Legal / compliance footer";
    case "unsubscribe":       return "Unsubscribe link";
    case "personalization":   return b.variable;
    case "event_card":        return b.event ? b.event.title : "(no event selected)";
    case "blog_card":         return b.post ? b.post.title : "(no post selected)";
    case "morning_boost_card":return b.boost ? b.boost.title : "(no boost selected)";
    case "resource_card":     return b.resource ? b.resource.title : "(no resource selected)";
    case "product_card":      return b.product ? b.product.name : "(no product selected)";
    case "membership_cta":    return b.heading;
    case "referral_cta":      return b.heading;
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateBlocks(blocks: EmailBlock[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let hasUnsubscribe = false;

  for (const b of blocks) {
    if (b.type === "image" && !b.alt.trim()) {
      issues.push({ blockId: b.id, message: "Image block is missing alt text" });
    }
    if (b.type === "button" && !b.href.trim()) {
      issues.push({ blockId: b.id, message: `Button "${b.label}" has no link URL` });
    }
    if (b.type === "button" && !b.label.trim()) {
      issues.push({ blockId: b.id, message: "Button has no label" });
    }
    if (b.type === "unsubscribe") hasUnsubscribe = true;
    if (b.type === "event_card" && !b.event) {
      issues.push({ blockId: b.id, message: "Event card block has no event selected" });
    }
    if (b.type === "blog_card" && !b.post) {
      issues.push({ blockId: b.id, message: "Blog card block has no post selected" });
    }
    if (b.type === "morning_boost_card" && !b.boost) {
      issues.push({ blockId: b.id, message: "Morning Boost card has no entry selected" });
    }
    if (b.type === "resource_card" && !b.resource) {
      issues.push({ blockId: b.id, message: "Resource card has no resource selected" });
    }
    if (b.type === "product_card" && !b.product) {
      issues.push({ blockId: b.id, message: "Product card has no product selected" });
    }
  }

  if (blocks.length > 0 && !hasUnsubscribe) {
    issues.push({ blockId: "", message: "No unsubscribe block — required for CAN-SPAM compliance" });
  }

  return issues;
}

// ── Preview wrapper ──────────────────────────────────────────────────────────

function wrapEmailHtml(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title></head><body style="margin:0;padding:20px 0;background:#f3f4f6;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;"><tr><td style="padding:20px;"><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:600px;width:100%;background:#ffffff;border-radius:10px;padding:40px;"><tr><td>${body}</td></tr></table></td></tr></table></body></html>`;
}

// ── Shared micro-components ──────────────────────────────────────────────────

const ALIGN_OPTS: BlockAlign[] = ["left", "center", "right"];

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-28 shrink-0 pt-1.5 text-xs font-semibold text-ink-soft">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
  );
}

function Textarea({ value, onChange, rows = 4, placeholder, mono }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; mono?: boolean }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
      className={`w-full rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 ${mono ? "font-mono" : ""}`} />
  );
}

function AlignPicker({ value, onChange }: { value: BlockAlign; onChange: (v: BlockAlign) => void }) {
  return (
    <div className="flex gap-1">
      {ALIGN_OPTS.map(a => (
        <button key={a} type="button" onClick={() => onChange(a)}
          className={`rounded px-2 py-1 text-xs font-medium capitalize ${value === a ? "bg-navy text-white" : "border border-navy/15 text-ink-soft hover:bg-cream-panel"}`}>
          {a}
        </button>
      ))}
    </div>
  );
}

// ── Generic content picker (for platform blocks) ─────────────────────────────

interface PickerOption { id: string; label: string }

function ContentPicker<T extends { id: string }>({
  endpoint, labelKey, current, onSelect,
}: {
  endpoint: string;
  labelKey: keyof T;
  current: T | null;
  onSelect: (item: T | null) => void;
}) {
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    fetch(endpoint)
      .then(r => r.json())
      .then(data => setOptions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [endpoint]);

  return (
    <select
      value={current?.id ?? ""}
      onChange={e => {
        const found = options.find(o => o.id === e.target.value) ?? null;
        onSelect(found);
      }}
      className="w-full rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
    >
      <option value="">{loading ? "Loading…" : "— Select —"}</option>
      {options.map(o => (
        <option key={o.id} value={o.id}>{String(o[labelKey])}</option>
      ))}
    </select>
  );
}

// ── Block editors ────────────────────────────────────────────────────────────

function HeadingEditor({ block, update }: { block: HeadingBlock; update: (p: Partial<HeadingBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Text"><Input value={block.text} onChange={v => update({ text: v })} placeholder="Heading text" /></FieldRow>
      <FieldRow label="Level">
        <div className="flex gap-1">
          {([1, 2, 3] as const).map(l => (
            <button key={l} type="button" onClick={() => update({ level: l })}
              className={`rounded px-2.5 py-1 text-xs font-bold ${block.level === l ? "bg-navy text-white" : "border border-navy/15 text-ink-soft hover:bg-cream-panel"}`}>
              H{l}
            </button>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Align"><AlignPicker value={block.align} onChange={v => update({ align: v })} /></FieldRow>
      <FieldRow label="Color"><Input type="color" value={block.color} onChange={v => update({ color: v })} /></FieldRow>
    </div>
  );
}

function TextEditor({ block, update }: { block: TextBlock; update: (p: Partial<TextBlock>) => void }) {
  return (
    <FieldRow label="Content">
      <Textarea value={block.html} onChange={v => update({ html: v })} rows={4}
        placeholder="Text content (basic HTML tags like <b>, <i>, <a href='...'> are supported)" />
    </FieldRow>
  );
}

function ButtonEditor({ block, update }: { block: ButtonBlock; update: (p: Partial<ButtonBlock>) => void }) {
  const [showUtm, setShowUtm] = useState(!!(block.utmSource || block.utmMedium || block.utmCampaign));
  return (
    <div className="space-y-3">
      <FieldRow label="Label"><Input value={block.label} onChange={v => update({ label: v })} placeholder="Button text" /></FieldRow>
      <FieldRow label="Link URL"><Input value={block.href} onChange={v => update({ href: v })} placeholder="https://" /></FieldRow>
      <FieldRow label="Align"><AlignPicker value={block.align} onChange={v => update({ align: v })} /></FieldRow>
      <FieldRow label="Background"><Input type="color" value={block.bgColor} onChange={v => update({ bgColor: v })} /></FieldRow>
      <FieldRow label="Text color"><Input type="color" value={block.textColor} onChange={v => update({ textColor: v })} /></FieldRow>
      <div>
        <button type="button" onClick={() => setShowUtm(v => !v)}
          className="text-xs font-semibold text-navy underline underline-offset-2">
          {showUtm ? "Hide UTM tracking" : "+ Add UTM tracking"}
        </button>
      </div>
      {showUtm && (
        <div className="space-y-3 rounded-lg border border-navy/10 bg-cream-panel/50 p-3">
          <p className="text-xs text-ink-soft">These parameters are appended to the button URL automatically.</p>
          <FieldRow label="utm_source"><Input value={block.utmSource ?? ""} onChange={v => update({ utmSource: v })} placeholder="email" /></FieldRow>
          <FieldRow label="utm_medium"><Input value={block.utmMedium ?? ""} onChange={v => update({ utmMedium: v })} placeholder="campaign" /></FieldRow>
          <FieldRow label="utm_campaign"><Input value={block.utmCampaign ?? ""} onChange={v => update({ utmCampaign: v })} placeholder="campaign-name" /></FieldRow>
        </div>
      )}
    </div>
  );
}

function ImageEditor({ block, update, onPickImage }: { block: ImageBlock; update: (p: Partial<ImageBlock>) => void; onPickImage?: (cb: (url: string) => void) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Image URL">
        <div className="flex gap-2">
          <Input value={block.src} onChange={v => update({ src: v })} placeholder="https://..." />
          {onPickImage && (
            <button type="button" onClick={() => onPickImage(url => update({ src: url }))}
              className="shrink-0 rounded-lg border border-navy/15 px-2.5 py-1.5 text-xs font-medium text-navy hover:bg-cream-panel">
              Browse
            </button>
          )}
        </div>
      </FieldRow>
      <FieldRow label="Alt text"><Input value={block.alt} onChange={v => update({ alt: v })} placeholder="Describe the image" /></FieldRow>
      <FieldRow label="Link URL"><Input value={block.href} onChange={v => update({ href: v })} placeholder="Optional — wrap image in a link" /></FieldRow>
      <FieldRow label="Max width">
        <div className="flex items-center gap-2">
          <input type="range" min={100} max={600} step={20} value={block.maxWidth}
            onChange={e => update({ maxWidth: Number(e.target.value) })} className="flex-1" />
          <span className="w-14 text-right text-xs text-ink-soft">{block.maxWidth}px</span>
        </div>
      </FieldRow>
      <FieldRow label="Align"><AlignPicker value={block.align} onChange={v => update({ align: v })} /></FieldRow>
    </div>
  );
}

function DividerEditor({ block, update }: { block: DividerBlock; update: (p: Partial<DividerBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Color"><Input type="color" value={block.color} onChange={v => update({ color: v })} /></FieldRow>
      <FieldRow label="Spacing">
        <div className="flex items-center gap-2">
          <input type="range" min={4} max={48} step={4} value={block.spacing}
            onChange={e => update({ spacing: Number(e.target.value) })} className="flex-1" />
          <span className="w-14 text-right text-xs text-ink-soft">{block.spacing}px</span>
        </div>
      </FieldRow>
    </div>
  );
}

function SpacerEditor({ block, update }: { block: SpacerBlock; update: (p: Partial<SpacerBlock>) => void }) {
  return (
    <FieldRow label="Height">
      <div className="flex items-center gap-2">
        <input type="range" min={8} max={96} step={8} value={block.height}
          onChange={e => update({ height: Number(e.target.value) })} className="flex-1" />
        <span className="w-14 text-right text-xs text-ink-soft">{block.height}px</span>
      </div>
    </FieldRow>
  );
}

function HtmlEditor({ block, update }: { block: HtmlBlock; update: (p: Partial<HtmlBlock>) => void }) {
  return (
    <FieldRow label="HTML">
      <Textarea value={block.content} onChange={v => update({ content: v })} rows={6} mono />
    </FieldRow>
  );
}

function ColumnsEditor({ block, update }: { block: ColumnsBlock; update: (p: Partial<ColumnsBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Split">
        <div className="flex items-center gap-2">
          <input type="range" min={30} max={70} step={5} value={Math.round(block.leftWeight * 100)}
            onChange={e => update({ leftWeight: Number(e.target.value) / 100 })} className="flex-1" />
          <span className="w-24 text-right text-xs text-ink-soft">
            {Math.round(block.leftWeight * 100)}% / {100 - Math.round(block.leftWeight * 100)}%
          </span>
        </div>
      </FieldRow>
      <FieldRow label="Left column">
        <Textarea value={block.leftHtml} onChange={v => update({ leftHtml: v })} rows={4} placeholder="Left column HTML" />
      </FieldRow>
      <FieldRow label="Right column">
        <Textarea value={block.rightHtml} onChange={v => update({ rightHtml: v })} rows={4} placeholder="Right column HTML" />
      </FieldRow>
    </div>
  );
}

const SOCIAL_PLATFORMS = ["facebook", "instagram", "twitter", "youtube", "linkedin", "tiktok"];

function SocialLinksEditor({ block, update }: { block: SocialLinksBlock; update: (p: Partial<SocialLinksBlock>) => void }) {
  function setLink(idx: number, url: string) {
    const links = block.links.map((l, i) => i === idx ? { ...l, url } : l);
    update({ links });
  }
  function addPlatform(platform: string) {
    if (block.links.find(l => l.platform === platform)) return;
    update({ links: [...block.links, { platform, url: "" }] });
  }
  function removeLink(idx: number) {
    update({ links: block.links.filter((_, i) => i !== idx) });
  }
  return (
    <div className="space-y-3">
      <FieldRow label="Align"><AlignPicker value={block.align} onChange={v => update({ align: v })} /></FieldRow>
      <FieldRow label="Links">
        <div className="space-y-2">
          {block.links.map((l, i) => (
            <div key={l.platform} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs font-semibold capitalize text-ink">{l.platform}</span>
              <Input value={l.url} onChange={v => setLink(i, v)} placeholder="https://..." />
              <button type="button" onClick={() => removeLink(i)} className="shrink-0 text-xs text-red-400 hover:text-red-600">✕</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1 pt-1">
            {SOCIAL_PLATFORMS.filter(p => !block.links.find(l => l.platform === p)).map(p => (
              <button key={p} type="button" onClick={() => addPlatform(p)}
                className="rounded border border-navy/15 px-2 py-0.5 text-xs capitalize text-navy hover:bg-cream-panel">
                + {p}
              </button>
            ))}
          </div>
        </div>
      </FieldRow>
    </div>
  );
}

function LegalFooterEditor({ block, update }: { block: LegalFooterBlock; update: (p: Partial<LegalFooterBlock>) => void }) {
  return (
    <FieldRow label="HTML">
      <Textarea value={block.html} onChange={v => update({ html: v })} rows={4} placeholder="Legal footer HTML" />
    </FieldRow>
  );
}

function UnsubscribeEditor({ block, update }: { block: UnsubscribeBlock; update: (p: Partial<UnsubscribeBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Text">
        <Textarea value={block.text} onChange={v => update({ text: v })} rows={3}
          placeholder="Use {{unsubscribe_url}} for the unsubscribe link" />
      </FieldRow>
      <FieldRow label="Align"><AlignPicker value={block.align} onChange={v => update({ align: v })} /></FieldRow>
      <p className="text-xs text-ink-soft pl-28">
        <code className="rounded bg-slate-100 px-1">{"{{unsubscribe_url}}"}</code> is replaced with the actual unsubscribe link at send time.
      </p>
    </div>
  );
}

function PersonalizationEditor({ block, update }: { block: PersonalizationBlock; update: (p: Partial<PersonalizationBlock>) => void }) {
  const VARS = [
    { label: "First name", variable: "{{first_name}}" },
    { label: "Full name", variable: "{{name}}" },
    { label: "Email", variable: "{{email}}" },
    { label: "Referral URL", variable: "{{referral_url}}" },
    { label: "Unsubscribe URL", variable: "{{unsubscribe_url}}" },
  ];
  return (
    <div className="space-y-3">
      <FieldRow label="Variable">
        <select value={block.variable} onChange={e => {
          const found = VARS.find(v => v.variable === e.target.value);
          update({ variable: e.target.value, label: found?.label ?? block.label });
        }} className="w-full rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30">
          {VARS.map(v => <option key={v.variable} value={v.variable}>{v.label} ({v.variable})</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Fallback">
        <Input value={block.fallback} onChange={v => update({ fallback: v })} placeholder="Shown if variable is empty" />
      </FieldRow>
    </div>
  );
}

function EventCardEditor({ block, update }: { block: EventCardBlock; update: (p: Partial<EventCardBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Event">
        <ContentPicker<EventSnapshot>
          endpoint="/api/admin/block-data/events"
          labelKey="title"
          current={block.event}
          onSelect={event => update({ event })}
        />
      </FieldRow>
      <FieldRow label="Button label">
        <Input value={block.buttonLabel} onChange={v => update({ buttonLabel: v })} placeholder="View Event" />
      </FieldRow>
    </div>
  );
}

function BlogCardEditor({ block, update }: { block: BlogCardBlock; update: (p: Partial<BlogCardBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Post">
        <ContentPicker<BlogSnapshot>
          endpoint="/api/admin/block-data/blog-posts"
          labelKey="title"
          current={block.post}
          onSelect={post => update({ post })}
        />
      </FieldRow>
      <FieldRow label="Button label">
        <Input value={block.buttonLabel} onChange={v => update({ buttonLabel: v })} placeholder="Read the Post" />
      </FieldRow>
    </div>
  );
}

function MorningBoostCardEditor({ block, update }: { block: MorningBoostCardBlock; update: (p: Partial<MorningBoostCardBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Entry">
        <ContentPicker<MorningBoostSnapshot>
          endpoint="/api/admin/block-data/morning-boost"
          labelKey="title"
          current={block.boost}
          onSelect={boost => update({ boost })}
        />
      </FieldRow>
      <FieldRow label="Button label">
        <Input value={block.buttonLabel} onChange={v => update({ buttonLabel: v })} placeholder="Read Today's Boost" />
      </FieldRow>
    </div>
  );
}

function ResourceCardEditor({ block, update }: { block: ResourceCardBlock; update: (p: Partial<ResourceCardBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Resource">
        <ContentPicker<ResourceSnapshot>
          endpoint="/api/admin/block-data/resources"
          labelKey="title"
          current={block.resource}
          onSelect={resource => update({ resource })}
        />
      </FieldRow>
      <FieldRow label="Button label">
        <Input value={block.buttonLabel} onChange={v => update({ buttonLabel: v })} placeholder="Download" />
      </FieldRow>
    </div>
  );
}

function ProductCardEditor({ block, update }: { block: ProductCardBlock; update: (p: Partial<ProductCardBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Product">
        <ContentPicker<ProductSnapshot>
          endpoint="/api/admin/block-data/products"
          labelKey="name"
          current={block.product}
          onSelect={product => update({ product })}
        />
      </FieldRow>
      <FieldRow label="Button label">
        <Input value={block.buttonLabel} onChange={v => update({ buttonLabel: v })} placeholder="Learn More" />
      </FieldRow>
    </div>
  );
}

function MembershipCtaEditor({ block, update }: { block: MembershipCtaBlock; update: (p: Partial<MembershipCtaBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Heading"><Input value={block.heading} onChange={v => update({ heading: v })} /></FieldRow>
      <FieldRow label="Body">
        <Textarea value={block.body} onChange={v => update({ body: v })} rows={3} />
      </FieldRow>
      <FieldRow label="Button label"><Input value={block.buttonLabel} onChange={v => update({ buttonLabel: v })} /></FieldRow>
      <FieldRow label="Button URL"><Input value={block.buttonHref} onChange={v => update({ buttonHref: v })} /></FieldRow>
      <FieldRow label="Background"><Input type="color" value={block.bgColor} onChange={v => update({ bgColor: v })} /></FieldRow>
    </div>
  );
}

function ReferralCtaEditor({ block, update }: { block: ReferralCtaBlock; update: (p: Partial<ReferralCtaBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Heading"><Input value={block.heading} onChange={v => update({ heading: v })} /></FieldRow>
      <FieldRow label="Body">
        <Textarea value={block.body} onChange={v => update({ body: v })} rows={3} />
      </FieldRow>
      <FieldRow label="Button label"><Input value={block.buttonLabel} onChange={v => update({ buttonLabel: v })} /></FieldRow>
      <p className="text-xs text-ink-soft pl-28">
        The button links to <code className="rounded bg-slate-100 px-1">{"{{referral_url}}"}</code>, replaced at send time.
      </p>
    </div>
  );
}

function BlockEditor({ block, onChange, onPickImage }: { block: EmailBlock; onChange: (b: EmailBlock) => void; onPickImage?: (cb: (url: string) => void) => void }) {
  function update<T extends EmailBlock>(patch: Partial<T>) {
    onChange({ ...block, ...patch } as EmailBlock);
  }
  switch (block.type) {
    case "heading":           return <HeadingEditor          block={block} update={update} />;
    case "text":              return <TextEditor             block={block} update={update} />;
    case "button":            return <ButtonEditor           block={block} update={update} />;
    case "image":             return <ImageEditor            block={block} update={update} onPickImage={onPickImage} />;
    case "divider":           return <DividerEditor          block={block} update={update} />;
    case "spacer":            return <SpacerEditor           block={block} update={update} />;
    case "html":              return <HtmlEditor             block={block} update={update} />;
    case "columns":           return <ColumnsEditor          block={block} update={update} />;
    case "social_links":      return <SocialLinksEditor      block={block} update={update} />;
    case "legal_footer":      return <LegalFooterEditor      block={block} update={update} />;
    case "unsubscribe":       return <UnsubscribeEditor      block={block} update={update} />;
    case "personalization":   return <PersonalizationEditor  block={block} update={update} />;
    case "event_card":        return <EventCardEditor        block={block} update={update} />;
    case "blog_card":         return <BlogCardEditor         block={block} update={update} />;
    case "morning_boost_card":return <MorningBoostCardEditor block={block} update={update} />;
    case "resource_card":     return <ResourceCardEditor     block={block} update={update} />;
    case "product_card":      return <ProductCardEditor      block={block} update={update} />;
    case "membership_cta":    return <MembershipCtaEditor    block={block} update={update} />;
    case "referral_cta":      return <ReferralCtaEditor      block={block} update={update} />;
  }
}

// ── Main component ─────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

export function BlockComposer({ initialBlocks, onChange, onPickImage, autosaveKey }: Props) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => {
    if (autosaveKey && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(autosaveKey);
        if (saved) {
          const parsed = JSON.parse(saved) as EmailBlock[];
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch { /* ignore */ }
    }
    return initialBlocks ?? [];
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [previewMode, setPreviewMode] = useState<null | "desktop" | "mobile">(null);
  const [sections, setSections] = useState<SavedSectionRow[]>([]);
  const [savingSection, setSavingSection] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const dragSrc = useRef<number | null>(null);
  const initialFired = useRef(false);
  const historyStack = useRef<EmailBlock[][]>([]);
  const historyIdx = useRef<number>(-1);

  // Fire onChange once on mount if initialBlocks provided (not from autosave)
  useEffect(() => {
    if (!initialFired.current) {
      initialFired.current = true;
      if (blocks.length > 0) onChange(blocksToHtml(blocks), blocks);
      // Seed history
      historyStack.current = [blocks];
      historyIdx.current = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave to localStorage
  useEffect(() => {
    if (!autosaveKey || !initialFired.current) return;
    try { localStorage.setItem(autosaveKey, JSON.stringify(blocks)); } catch { /* ignore */ }
  }, [blocks, autosaveKey]);

  // Load saved sections when panel opens
  useEffect(() => {
    if (!showSections) return;
    fetch("/api/admin/saved-sections")
      .then(r => r.json())
      .then(data => setSections(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [showSections]);

  function pushHistory(next: EmailBlock[]) {
    const stack = historyStack.current;
    const idx = historyIdx.current;
    // Drop any redo states ahead of current position
    stack.splice(idx + 1);
    stack.push(next);
    if (stack.length > MAX_HISTORY) stack.shift();
    historyIdx.current = stack.length - 1;
    setCanUndo(historyIdx.current > 0);
    setCanRedo(false);
  }

  function commit(next: EmailBlock[]) {
    setBlocks(next);
    onChange(blocksToHtml(next), next);
    pushHistory(next);
  }

  function undo() {
    const idx = historyIdx.current;
    if (idx <= 0) return;
    historyIdx.current = idx - 1;
    const prev = historyStack.current[historyIdx.current];
    setBlocks(prev);
    onChange(blocksToHtml(prev), prev);
    setCanUndo(historyIdx.current > 0);
    setCanRedo(true);
  }

  function redo() {
    const idx = historyIdx.current;
    const stack = historyStack.current;
    if (idx >= stack.length - 1) return;
    historyIdx.current = idx + 1;
    const next = stack[historyIdx.current];
    setBlocks(next);
    onChange(blocksToHtml(next), next);
    setCanUndo(true);
    setCanRedo(historyIdx.current < stack.length - 1);
  }

  function addBlock(type: EmailBlockType) {
    const b = defaultBlock(type);
    commit([...blocks, b]);
    setSelected(b.id);
    setShowSections(false);
  }

  function updateBlock(b: EmailBlock) {
    commit(blocks.map(x => (x.id === b.id ? b : x)));
  }

  function removeBlock(id: string) {
    commit(blocks.filter(x => x.id !== id));
    if (selected === id) setSelected(null);
  }

  function duplicateBlock(id: string) {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const clone = { ...blocks[idx], id: newId() };
    const next = [...blocks];
    next.splice(idx + 1, 0, clone);
    commit(next);
    setSelected(clone.id);
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    const to = idx + dir;
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[to]] = [next[to], next[idx]];
    commit(next);
  }

  function handleDragStart(idx: number) { dragSrc.current = idx; }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragSrc.current === null || dragSrc.current === idx) return;
    const next = [...blocks];
    const [removed] = next.splice(dragSrc.current, 1);
    next.splice(idx, 0, removed);
    dragSrc.current = idx;
    setBlocks(next);
    onChange(blocksToHtml(next), next);
  }
  function handleDragEnd() {
    dragSrc.current = null;
    pushHistory(blocks);
  }

  async function saveAsSection() {
    const name = prompt("Section name:");
    if (!name?.trim()) return;
    setSavingSection(true);
    try {
      await fetch("/api/admin/saved-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), blocks }),
      });
    } finally { setSavingSection(false); }
  }

  function insertSection(row: SavedSectionRow) {
    const incoming = (row.blocks as EmailBlock[]).map(b => ({ ...b, id: newId() }));
    commit([...blocks, ...incoming]);
    setShowSections(false);
  }

  async function deleteSection(id: string) {
    await fetch(`/api/admin/saved-sections/${id}`, { method: "DELETE" });
    setSections(prev => prev.filter(s => s.id !== id));
  }

  function clearAutosave() {
    if (autosaveKey) {
      try { localStorage.removeItem(autosaveKey); } catch { /* ignore */ }
    }
  }

  const issues = showValidation ? validateBlocks(blocks) : [];
  const issueMap = new Map(issues.map(i => [i.blockId, i.message]));

  return (
    <div className="rounded-xl border border-navy/8 bg-white overflow-hidden">
      {/* Palette */}
      <div className="border-b border-navy/8 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          <span className="self-center text-xs font-semibold text-ink-soft mr-1">Add:</span>
          {PALETTE_GROUPS.map(group => (
            <span key={group.label} className="contents">
              {group.items.map(({ type, label }) => (
                <button key={type} type="button" onClick={() => addBlock(type)}
                  className="rounded-lg border border-navy/15 bg-white px-2 py-1 text-xs font-medium text-navy hover:bg-cream-panel transition-colors">
                  {label}
                </button>
              ))}
              <span className="mx-1 text-navy/20">|</span>
            </span>
          ))}
        </div>

        {/* Toolbar row */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
            className="rounded-lg border border-navy/15 bg-white px-2 py-1 text-xs font-medium text-ink-soft hover:bg-cream-panel disabled:opacity-30 disabled:cursor-not-allowed">
            ↩ Undo
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
            className="rounded-lg border border-navy/15 bg-white px-2 py-1 text-xs font-medium text-ink-soft hover:bg-cream-panel disabled:opacity-30 disabled:cursor-not-allowed">
            ↪ Redo
          </button>
          <span className="text-navy/20">|</span>
          <button type="button"
            onClick={() => { setPreviewMode(m => m === "desktop" ? null : "desktop"); setShowHtml(false); setShowSections(false); }}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${previewMode === "desktop" ? "bg-navy text-white" : "border border-navy/15 bg-white text-ink-soft hover:bg-cream-panel"}`}>
            Desktop preview
          </button>
          <button type="button"
            onClick={() => { setPreviewMode(m => m === "mobile" ? null : "mobile"); setShowHtml(false); setShowSections(false); }}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${previewMode === "mobile" ? "bg-navy text-white" : "border border-navy/15 bg-white text-ink-soft hover:bg-cream-panel"}`}>
            Mobile preview
          </button>
          <span className="text-navy/20">|</span>
          <button type="button"
            onClick={() => { setShowValidation(v => !v); setShowHtml(false); setShowSections(false); setPreviewMode(null); }}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${showValidation ? "bg-amber-500 text-white" : "border border-navy/15 bg-white text-ink-soft hover:bg-cream-panel"}`}>
            Validate
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            {blocks.length > 0 && (
              <button type="button" onClick={saveAsSection} disabled={savingSection}
                className="rounded-lg border border-navy/15 bg-white px-2 py-1 text-xs font-medium text-ink-soft hover:bg-cream-panel disabled:opacity-50">
                {savingSection ? "Saving…" : "Save section"}
              </button>
            )}
            <button type="button" onClick={() => { setShowSections(v => !v); setShowHtml(false); setPreviewMode(null); }}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${showSections ? "bg-navy text-white" : "border border-navy/15 bg-white text-ink-soft hover:bg-cream-panel"}`}>
              Sections
            </button>
            <button type="button" onClick={() => { setShowHtml(v => !v); setShowSections(false); setPreviewMode(null); }}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${showHtml ? "bg-navy text-white" : "border border-navy/15 bg-white text-ink-soft hover:bg-cream-panel"}`}>
              {showHtml ? "Hide HTML" : "View HTML"}
            </button>
          </div>
        </div>
      </div>

      {/* Validation panel */}
      {showValidation && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-700">Pre-send validation</p>
          {issues.length === 0 ? (
            <p className="text-sm text-green-700 font-semibold">All checks passed.</p>
          ) : (
            <ul className="space-y-1">
              {issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                  <span className="shrink-0 font-bold">•</span>
                  <span>
                    {issue.message}
                    {issue.blockId && (
                      <button type="button" onClick={() => { setSelected(issue.blockId); setShowValidation(false); }}
                        className="ml-1 text-xs underline text-amber-700 hover:text-amber-900">
                        (jump to block)
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Saved sections panel */}
      {showSections && (
        <div className="border-b border-navy/8 bg-cream-panel/60 px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-soft">Saved sections</p>
          {sections.length === 0 ? (
            <p className="text-sm text-ink-soft">No saved sections yet. Build blocks and click "Save section" to store them.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sections.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-navy/10 bg-white px-3 py-2">
                  <button type="button" onClick={() => insertSection(s)}
                    className="text-left text-sm font-medium text-navy hover:underline truncate mr-2">
                    {s.name}
                  </button>
                  <button type="button" onClick={() => deleteSection(s.id)}
                    className="shrink-0 text-xs text-red-400 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview iframe */}
      {previewMode && (
        <div className="border-b border-navy/8 bg-slate-100 p-4">
          <div className="mx-auto overflow-hidden rounded-xl border border-navy/15 bg-white shadow-sm"
            style={{ width: previewMode === "mobile" ? 375 : "100%", maxWidth: 600 }}>
            <iframe
              srcDoc={wrapEmailHtml(blocksToHtml(blocks))}
              style={{ width: "100%", height: 500, border: "none" }}
              title="Email preview"
              sandbox="allow-same-origin"
            />
          </div>
          <p className="mt-2 text-center text-xs text-ink-soft">
            {previewMode === "mobile" ? "Mobile view — 375px" : "Desktop view — 600px max"}
          </p>
        </div>
      )}

      {/* Block list */}
      <div className="divide-y divide-navy/5">
        {blocks.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-ink-soft">
            Add a block above to start building your email
          </div>
        )}
        {blocks.map((block, idx) => {
          const isSelected = selected === block.id;
          const issue = issueMap.get(block.id);
          return (
            <div key={block.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className="group">
              <div
                onClick={() => setSelected(isSelected ? null : block.id)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${isSelected ? "bg-indigo-50" : issue ? "bg-amber-50" : "hover:bg-slate-50"}`}>
                <span className="cursor-grab text-ink-soft opacity-40 group-hover:opacity-100 select-none" title="Drag to reorder">⠿</span>
                <span className="shrink-0 rounded bg-navy/8 px-1.5 py-0.5 text-xs font-semibold text-navy">{TYPE_LABELS[block.type]}</span>
                <span className="flex-1 truncate text-sm text-ink">{blockSummary(block)}</span>
                {issue && <span className="shrink-0 text-xs text-amber-600" title={issue}>⚠</span>}
                <span className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={() => moveBlock(idx, -1)} disabled={idx === 0}
                    className="rounded px-1.5 py-0.5 text-xs text-ink-soft hover:bg-navy/8 disabled:opacity-30" title="Move up">↑</button>
                  <button type="button" onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1}
                    className="rounded px-1.5 py-0.5 text-xs text-ink-soft hover:bg-navy/8 disabled:opacity-30" title="Move down">↓</button>
                  <button type="button" onClick={() => duplicateBlock(block.id)}
                    className="rounded px-1.5 py-0.5 text-xs text-ink-soft hover:bg-navy/8" title="Duplicate">⎘</button>
                  <button type="button" onClick={() => removeBlock(block.id)}
                    className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-50" title="Delete">✕</button>
                </span>
              </div>
              {isSelected && (
                <div className="border-t border-navy/8 bg-slate-50 px-4 py-4">
                  <BlockEditor block={block} onChange={updateBlock} onPickImage={onPickImage} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* HTML output */}
      {showHtml && (
        <div className="border-t border-navy/8 bg-slate-50 px-4 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Generated HTML</p>
          <textarea readOnly value={blocksToHtml(blocks)} rows={8}
            className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-xs font-mono text-ink focus:outline-none"
            onClick={e => (e.target as HTMLTextAreaElement).select()} />
        </div>
      )}
    </div>
  );
}
