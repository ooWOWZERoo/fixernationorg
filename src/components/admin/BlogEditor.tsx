import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";

interface BlogEditorProps {
  value: string;
  onChange: (html: string) => void;
}

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-md px-2 py-1 text-sm font-semibold transition-colors ${
        active ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-4 w-px bg-slate-300" />;

// The editing surface uses the same `.blog-content` styles as the public post
// page (see globals.css) and the same 48rem measure (max-w-3xl), so line
// wrapping and spacing here match what gets published.
export function BlogEditor({ value, onChange }: BlogEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } },
      }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "blog-content min-h-[320px] focus:outline-none" },
    },
    immediatelyRender: false,
  });

  // useEditor only reads `value` once, so external writes need to be pushed in.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/blog/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed.");
      } else {
        const alt = window.prompt("Describe the image (alt text, for accessibility)", "") ?? "";
        editor.chain().focus().setImage({ src: data.url, alt }).run();
      }
    } catch {
      setUploadError("Network error during upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const chain = () => editor.chain().focus();

  return (
    <div className="rounded-lg border border-slate-300 focus-within:border-navy focus-within:ring-1 focus-within:ring-navy">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}>B</ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()}>
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()}>
          <span className="line-through">S</span>
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Paragraph" active={editor.isActive("paragraph")} onClick={() => chain().setParagraph().run()}>¶</ToolbarButton>
        <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
        <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
        <ToolbarButton label="Heading 4" active={editor.isActive("heading", { level: 4 })} onClick={() => chain().toggleHeading({ level: 4 }).run()}>H4</ToolbarButton>
        <Divider />
        <ToolbarButton label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => chain().setTextAlign("left").run()}>⇤</ToolbarButton>
        <ToolbarButton label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => chain().setTextAlign("center").run()}>↔</ToolbarButton>
        <ToolbarButton label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => chain().setTextAlign("right").run()}>⇥</ToolbarButton>
        <ToolbarButton label="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => chain().setTextAlign("justify").run()}>☰</ToolbarButton>
        <Divider />
        <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}>• List</ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}>1. List</ToolbarButton>
        <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()}>&ldquo;</ToolbarButton>
        <ToolbarButton label="Divider line" onClick={() => chain().setHorizontalRule().run()}>―</ToolbarButton>
        <Divider />
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={setLink}>Link</ToolbarButton>
        <ToolbarButton label="Insert image" onClick={() => fileRef.current?.click()}>{uploading ? "Uploading…" : "Image"}</ToolbarButton>
        <Divider />
        <ToolbarButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>Clear</ToolbarButton>
        <ToolbarButton label="Undo" onClick={() => chain().undo().run()}>↺</ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => chain().redo().run()}>↻</ToolbarButton>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageFile} />
      </div>
      {uploadError && <p className="px-3 pt-2 text-xs text-red-600">{uploadError}</p>}
      <div className="px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
