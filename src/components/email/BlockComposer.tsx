"use client";
import { useState, useRef, useEffect } from "react";
import {
  type EmailBlock, type EmailBlockType, type BlockAlign,
  type HeadingBlock, type TextBlock, type ButtonBlock,
  type ImageBlock, type DividerBlock, type SpacerBlock, type HtmlBlock,
  defaultBlock, blocksToHtml, newId,
} from "@/lib/email-blocks";

interface SavedSectionRow { id: string; name: string; blocks: unknown }

interface Props {
  initialBlocks?: EmailBlock[];
  onChange: (html: string, blocks: EmailBlock[]) => void;
  onPickImage?: (cb: (url: string) => void) => void;
}

const PALETTE: { type: EmailBlockType; label: string }[] = [
  { type: "heading",  label: "Heading" },
  { type: "text",     label: "Text" },
  { type: "button",   label: "Button" },
  { type: "image",    label: "Image" },
  { type: "divider",  label: "Divider" },
  { type: "spacer",   label: "Spacer" },
  { type: "html",     label: "HTML" },
];

const TYPE_LABELS: Record<EmailBlockType, string> = {
  heading: "Heading", text: "Text", button: "Button",
  image: "Image", divider: "Divider", spacer: "Spacer", html: "HTML",
};

function blockSummary(b: EmailBlock): string {
  switch (b.type) {
    case "heading": return b.text.slice(0, 60) || "(empty)";
    case "text":    return b.html.replace(/<[^>]+>/g, "").slice(0, 60) || "(empty)";
    case "button":  return b.label || "(no label)";
    case "image":   return b.src ? b.src.split("/").pop() ?? b.src : "(no image)";
    case "divider": return `${b.spacing}px spacing`;
    case "spacer":  return `${b.height}px height`;
    case "html":    return b.content.replace(/<[^>]+>/g, "").slice(0, 60) || "(empty)";
  }
}

// ── Inline block editors ─────────────────────────────────────────────────────

const ALIGN_OPTS: BlockAlign[] = ["left", "center", "right"];

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 pt-1.5 text-xs font-semibold text-ink-soft">{label}</span>
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
    <div className="space-y-3">
      <FieldRow label="Content">
        <textarea value={block.html} onChange={e => update({ html: e.target.value })} rows={4}
          placeholder="Text content (basic HTML tags like <b>, <i>, <a href='...'> are supported)"
          className="w-full rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
      </FieldRow>
    </div>
  );
}

function ButtonEditor({ block, update }: { block: ButtonBlock; update: (p: Partial<ButtonBlock>) => void }) {
  return (
    <div className="space-y-3">
      <FieldRow label="Label"><Input value={block.label} onChange={v => update({ label: v })} placeholder="Button text" /></FieldRow>
      <FieldRow label="Link URL"><Input value={block.href} onChange={v => update({ href: v })} placeholder="https://" /></FieldRow>
      <FieldRow label="Align"><AlignPicker value={block.align} onChange={v => update({ align: v })} /></FieldRow>
      <FieldRow label="Background"><Input type="color" value={block.bgColor} onChange={v => update({ bgColor: v })} /></FieldRow>
      <FieldRow label="Text color"><Input type="color" value={block.textColor} onChange={v => update({ textColor: v })} /></FieldRow>
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
            <button type="button"
              onClick={() => onPickImage(url => update({ src: url }))}
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
      <textarea value={block.content} onChange={e => update({ content: e.target.value })} rows={6}
        className="w-full rounded-lg border border-navy/15 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/30" />
    </FieldRow>
  );
}

function BlockEditor({ block, onChange, onPickImage }: { block: EmailBlock; onChange: (b: EmailBlock) => void; onPickImage?: (cb: (url: string) => void) => void }) {
  function update<T extends EmailBlock>(patch: Partial<T>) {
    onChange({ ...block, ...patch } as EmailBlock);
  }
  switch (block.type) {
    case "heading":  return <HeadingEditor  block={block} update={update} />;
    case "text":     return <TextEditor     block={block} update={update} />;
    case "button":   return <ButtonEditor   block={block} update={update} />;
    case "image":    return <ImageEditor    block={block} update={update} onPickImage={onPickImage} />;
    case "divider":  return <DividerEditor  block={block} update={update} />;
    case "spacer":   return <SpacerEditor   block={block} update={update} />;
    case "html":     return <HtmlEditor     block={block} update={update} />;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function BlockComposer({ initialBlocks, onChange, onPickImage }: Props) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const [sections, setSections] = useState<SavedSectionRow[]>([]);
  const [savingSection, setSavingSection] = useState(false);
  const dragSrc = useRef<number | null>(null);
  const initialFired = useRef(false);

  // Fire onChange once on mount if initialBlocks provided
  useEffect(() => {
    if (!initialFired.current && (initialBlocks ?? []).length > 0) {
      initialFired.current = true;
      onChange(blocksToHtml(initialBlocks!), initialBlocks!);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved sections when panel opens
  useEffect(() => {
    if (!showSections) return;
    fetch("/api/admin/saved-sections")
      .then(r => r.json())
      .then(data => setSections(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [showSections]);

  function update(next: EmailBlock[]) {
    setBlocks(next);
    onChange(blocksToHtml(next), next);
  }

  function addBlock(type: EmailBlockType) {
    const b = defaultBlock(type);
    const next = [...blocks, b];
    update(next);
    setSelected(b.id);
    setShowSections(false);
  }

  function updateBlock(b: EmailBlock) {
    const next = blocks.map(x => (x.id === b.id ? b : x));
    update(next);
  }

  function removeBlock(id: string) {
    update(blocks.filter(x => x.id !== id));
    if (selected === id) setSelected(null);
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    const next = [...blocks];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    update(next);
  }

  function handleDragStart(idx: number) { dragSrc.current = idx; }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragSrc.current === null || dragSrc.current === idx) return;
    const next = [...blocks];
    const [removed] = next.splice(dragSrc.current, 1);
    next.splice(idx, 0, removed);
    dragSrc.current = idx;
    update(next);
  }
  function handleDragEnd() { dragSrc.current = null; }

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
    const next = [...blocks, ...incoming];
    update(next);
    setShowSections(false);
  }

  async function deleteSection(id: string) {
    await fetch(`/api/admin/saved-sections/${id}`, { method: "DELETE" });
    setSections(prev => prev.filter(s => s.id !== id));
  }

  const generatedHtml = blocksToHtml(blocks);

  return (
    <div className="rounded-xl border border-navy/8 bg-white overflow-hidden">
      {/* Palette */}
      <div className="flex flex-wrap gap-1.5 border-b border-navy/8 bg-slate-50 px-4 py-3">
        <span className="self-center text-xs font-semibold text-ink-soft mr-1">Add block:</span>
        {PALETTE.map(({ type, label }) => (
          <button key={type} type="button" onClick={() => addBlock(type)}
            className="rounded-lg border border-navy/15 bg-white px-2.5 py-1 text-xs font-medium text-navy hover:bg-cream-panel transition-colors">
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          {blocks.length > 0 && (
            <button type="button" onClick={saveAsSection} disabled={savingSection}
              className="rounded-lg border border-navy/15 bg-white px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-cream-panel disabled:opacity-50">
              {savingSection ? "Saving…" : "Save section"}
            </button>
          )}
          <button type="button" onClick={() => { setShowSections(v => !v); setShowHtml(false); }}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${showSections ? "bg-navy text-white" : "border border-navy/15 text-ink-soft hover:bg-cream-panel"}`}>
            Sections
          </button>
          <button type="button" onClick={() => { setShowHtml(v => !v); setShowSections(false); }}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${showHtml ? "bg-navy text-white" : "border border-navy/15 text-ink-soft hover:bg-cream-panel"}`}>
            {showHtml ? "Hide HTML" : "View HTML"}
          </button>
        </div>
      </div>

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

      {/* Block list */}
      <div className="divide-y divide-navy/5">
        {blocks.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-ink-soft">
            Add a block above to start building your email
          </div>
        )}
        {blocks.map((block, idx) => {
          const isSelected = selected === block.id;
          return (
            <div key={block.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className="group">
              <div
                onClick={() => setSelected(isSelected ? null : block.id)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${isSelected ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
                <span className="cursor-grab text-ink-soft opacity-40 group-hover:opacity-100 select-none" title="Drag to reorder">⠿</span>
                <span className="shrink-0 rounded bg-navy/8 px-1.5 py-0.5 text-xs font-semibold text-navy">{TYPE_LABELS[block.type]}</span>
                <span className="flex-1 truncate text-sm text-ink">{blockSummary(block)}</span>
                <span className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={() => moveBlock(idx, -1)} disabled={idx === 0}
                    className="rounded px-1.5 py-0.5 text-xs text-ink-soft hover:bg-navy/8 disabled:opacity-30" title="Move up">↑</button>
                  <button type="button" onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1}
                    className="rounded px-1.5 py-0.5 text-xs text-ink-soft hover:bg-navy/8 disabled:opacity-30" title="Move down">↓</button>
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
          <textarea readOnly value={generatedHtml} rows={8}
            className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-xs font-mono text-ink focus:outline-none"
            onClick={e => (e.target as HTMLTextAreaElement).select()} />
        </div>
      )}
    </div>
  );
}
