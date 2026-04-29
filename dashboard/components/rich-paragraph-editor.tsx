"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { TextStyle } from "@tiptap/extension-text-style";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import HardBreak from "@tiptap/extension-hard-break";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import Link from "@tiptap/extension-link";
import CharacterCount from "@tiptap/extension-character-count";
import { UndoRedo } from "@tiptap/extensions";

// ── Extended TextStyle: adds font-family and font-size to the TextStyle mark
// so all inline styles live in one <span> instead of nested spans. ─────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const ExtendedTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontFamily: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const ff = el.style.fontFamily;
          if (!ff) return null;
          return ff.replace(/['"]/g, "").split(",")[0].trim();
        },
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.fontFamily) return {};
          return { style: `font-family: '${attrs.fontFamily as string}', serif` };
        },
      },
      fontSize: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.fontSize || null,
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.fontSize) return {};
          return { style: `font-size: ${attrs.fontSize as string}` };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFontFamily: (fontFamily: string) => ({ commands }: any) =>
        commands.setMark(this.name, { fontFamily }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unsetFontFamily: () => ({ commands }: any) =>
        commands.updateAttributes(this.name, { fontFamily: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFontSize: (fontSize: string) => ({ commands }: any) =>
        commands.setMark(this.name, { fontSize }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unsetFontSize: () => ({ commands }: any) =>
        commands.updateAttributes(this.name, { fontSize: null }),
    };
  },
});

// ── Font data ─────────────────────────────────────────────────────────────────

const FONT_GROUPS: { label: string; fonts: { label: string; value: string }[] }[] = [
  {
    label: "قرآني / عثماني",
    fonts: [
      { label: "أميري", value: "Amiri" },
      { label: "أميري قرآن (عثماني)", value: "Amiri Quran" },
      { label: "شهرزاد الجديد", value: "Scheherazade New" },
      { label: "لطيف", value: "Lateef" },
      { label: "نوتو نسخ عربي", value: "Noto Naskh Arabic" },
    ],
  },
  {
    label: "تقليدي",
    fonts: [
      { label: "مركزي", value: "Markazi Text" },
      { label: "رقعة عريف", value: "Aref Ruqaa" },
    ],
  },
  {
    label: "كوفي",
    fonts: [
      { label: "ريم كوفي", value: "Reem Kufi" },
      { label: "نوتو كوفي عربي", value: "Noto Kufi Arabic" },
    ],
  },
  {
    label: "حديث",
    fonts: [
      { label: "كايرو", value: "Cairo" },
      { label: "تجوّل", value: "Tajawal" },
      { label: "المسيري", value: "El Messiri" },
      { label: "المراعي", value: "Almarai" },
      { label: "ريدكس برو", value: "Readex Pro" },
      { label: "IBM بلكس عربي", value: "IBM Plex Arabic" },
      { label: "مدى", value: "Mada" },
    ],
  },
];

const FONT_SIZES: { label: string; value: string }[] = [
  { label: "صغير جداً — 12", value: "0.75rem" },
  { label: "صغير — 14", value: "0.875rem" },
  { label: "عادي — 16", value: "" },
  { label: "كبير — 18", value: "1.125rem" },
  { label: "أكبر — 20", value: "1.25rem" },
  { label: "رأس 3 — 24", value: "1.5rem" },
  { label: "رأس 2 — 28", value: "1.75rem" },
  { label: "رأس 1 — 32", value: "2rem" },
  { label: "ضخم — 40", value: "2.5rem" },
];

// ── Color palette ─────────────────────────────────────────────────────────────

const PRESET_COLORS: { label: string; value: string }[] = [
  { label: "أسود", value: "#1d1d1f" },
  { label: "رمادي داكن", value: "#4b5563" },
  { label: "رمادي فاتح", value: "#9ca3af" },
  { label: "أحمر داكن", value: "#8a244b" },
  { label: "أحمر", value: "#dc2626" },
  { label: "برتقالي", value: "#d97706" },
  { label: "ذهبي", value: "#ca8a04" },
  { label: "أخضر", value: "#16a34a" },
  { label: "أزرق", value: "#2563eb" },
  { label: "أزرق سماوي", value: "#0891b2" },
  { label: "بنفسجي", value: "#7c3aed" },
  { label: "بني", value: "#92400e" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

type Props = {
  value: string;
  onChange: (html: string) => void;
};

function toEditorContent(value: string): string {
  if (!value) return "<p></p>";
  if (value.startsWith("<p>") || value.startsWith("<p ")) return value;
  return `<p>${value}</p>`;
}

function fromEditorContent(html: string): string {
  return html.replace(/^<p>([\s\S]*?)<\/p>$/, "$1");
}

// ── SVG alignment icons ───────────────────────────────────────────────────────

function AlignRightIcon() {
  return (
    <svg width="14" height="13" viewBox="0 0 14 13" fill="currentColor" aria-hidden>
      <rect x="0" y="0" width="14" height="2" rx="1" />
      <rect x="4" y="4" width="10" height="2" rx="1" />
      <rect x="0" y="8" width="14" height="2" rx="1" />
      <rect x="5" y="12" width="9" height="2" rx="1" />
    </svg>
  );
}
function AlignCenterIcon() {
  return (
    <svg width="14" height="13" viewBox="0 0 14 13" fill="currentColor" aria-hidden>
      <rect x="0" y="0" width="14" height="2" rx="1" />
      <rect x="2" y="4" width="10" height="2" rx="1" />
      <rect x="0" y="8" width="14" height="2" rx="1" />
      <rect x="3" y="12" width="8" height="2" rx="1" />
    </svg>
  );
}
function AlignLeftIcon() {
  return (
    <svg width="14" height="13" viewBox="0 0 14 13" fill="currentColor" aria-hidden>
      <rect x="0" y="0" width="14" height="2" rx="1" />
      <rect x="0" y="4" width="10" height="2" rx="1" />
      <rect x="0" y="8" width="14" height="2" rx="1" />
      <rect x="0" y="12" width="9" height="2" rx="1" />
    </svg>
  );
}
function AlignJustifyIcon() {
  return (
    <svg width="14" height="13" viewBox="0 0 14 13" fill="currentColor" aria-hidden>
      <rect x="0" y="0" width="14" height="2" rx="1" />
      <rect x="0" y="4" width="14" height="2" rx="1" />
      <rect x="0" y="8" width="14" height="2" rx="1" />
      <rect x="0" y="12" width="14" height="2" rx="1" />
    </svg>
  );
}

// ── Toolbar primitives ────────────────────────────────────────────────────────

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`rich-btn${active ? " active" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="rich-toolbar-sep" />;
}

// ── Color picker popover ──────────────────────────────────────────────────────

type ColorPickerProps = {
  currentColor: string;
  onSet: (color: string) => void;
  onUnset: () => void;
  onClose: () => void;
};

function ColorPicker({ currentColor, onSet, onUnset, onClose }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div className="rich-color-popover" ref={ref}>
      <div className="rich-color-swatches">
        <button
          className={`rich-color-swatch rich-color-swatch-default${!currentColor ? " active" : ""}`}
          title="تلقائي (إزالة اللون)"
          onMouseDown={(e) => { e.preventDefault(); onUnset(); onClose(); }}
        />
        {PRESET_COLORS.map(({ label, value }) => (
          <button
            key={value}
            className={`rich-color-swatch${currentColor === value ? " active" : ""}`}
            style={{ background: value }}
            title={label}
            onMouseDown={(e) => { e.preventDefault(); onSet(value); onClose(); }}
          />
        ))}
      </div>
      <div className="rich-color-custom-row">
        <span className="rich-color-custom-label">لون مخصص</span>
        <input
          type="color"
          className="rich-color-custom-input"
          value={currentColor || "#1d1d1f"}
          onChange={(e) => onSet(e.target.value)}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RichParagraphEditor({ value, onChange }: Props) {
  const isInternalChange = useRef(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      Dropcursor,
      Gapcursor,
      UndoRedo,
      Bold,
      Italic,
      Strike,
      Underline,
      Highlight,
      Superscript,
      Subscript,
      ExtendedTextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      TextAlign.configure({
        types: ["paragraph"],
        defaultAlignment: "right",
        alignments: ["right", "center", "left", "justify"],
      }),
      CharacterCount,
    ],
    content: toEditorContent(value),
    onUpdate({ editor }) {
      isInternalChange.current = true;
      onChange(fromEditorContent(editor.getHTML()));
    },
    editorProps: {
      attributes: { dir: "rtl", class: "rich-editor-content" },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const current = fromEditorContent(editor.getHTML());
    if (current !== value) {
      editor.commands.setContent(toEditorContent(value));
    }
  }, [editor, value]);

  const textStyleAttrs = editor?.getAttributes("textStyle") ?? {};
  const currentFont = (textStyleAttrs.fontFamily as string) ?? "";
  const currentSize = (textStyleAttrs.fontSize as string) ?? "";
  const currentColor = (textStyleAttrs.color as string) ?? "";
  const canUndo = editor?.can().undo() ?? false;
  const canRedo = editor?.can().redo() ?? false;

  const currentAlignment = editor?.isActive({ textAlign: "center" })
    ? "center"
    : editor?.isActive({ textAlign: "left" })
    ? "left"
    : editor?.isActive({ textAlign: "justify" })
    ? "justify"
    : "right";

  function handleLink() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = window.prompt("أدخل الرابط (URL):", "https://");
      if (url?.trim()) {
        editor.chain().focus().setLink({ href: url.trim() }).run();
      }
    }
  }

  const charCount = editor?.storage.characterCount?.characters() ?? 0;
  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" dir="rtl">

        {/* Font family */}
        <div className="rich-toolbar-group">
          <select
            className="rich-font-select"
            value={currentFont}
            title="نوع الخط"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const font = e.target.value;
              if (font) {
                editor?.chain().focus().setFontFamily(font).run();
              } else {
                editor?.chain().focus().unsetFontFamily().run();
              }
            }}
          >
            <option value="">الخط الافتراضي</option>
            {FONT_GROUPS.map((group) => (
              <optgroup key={group.label} label={`── ${group.label} ──`}>
                {group.fonts.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Font size */}
        <div className="rich-toolbar-group">
          <select
            className="rich-size-select"
            value={currentSize}
            title="حجم الخط"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const size = e.target.value;
              if (size) {
                editor?.chain().focus().setFontSize(size).run();
              } else {
                editor?.chain().focus().unsetFontSize().run();
              }
            }}
          >
            {FONT_SIZES.map((s) => (
              <option key={s.value || "default"} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <Sep />

        {/* Formatting */}
        <div className="rich-toolbar-group">
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive("bold")}
            title="نص عريض (Ctrl+B)"
          >
            <strong>ع</strong>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive("italic")}
            title="نص مائل (Ctrl+I)"
          >
            <em>ع</em>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            active={editor?.isActive("underline")}
            title="تسطير (Ctrl+U)"
          >
            <u>ع</u>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            active={editor?.isActive("strike")}
            title="يتوسطه خط"
          >
            <s>ع</s>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleMark("highlight").run()}
            active={editor?.isActive("highlight")}
            title="تمييز بالأصفر"
          >
            <span className="rich-btn-highlight">ع</span>
          </ToolbarButton>
        </div>

        <Sep />

        {/* Text color */}
        <div className="rich-toolbar-group">
          <div className="rich-color-wrapper">
            <ToolbarButton
              onClick={() => setColorPickerOpen((v) => !v)}
              active={colorPickerOpen || !!currentColor}
              title="لون النص"
            >
              <span
                className="rich-color-indicator"
                style={{ color: currentColor || "currentColor" }}
              >
                ع
              </span>
            </ToolbarButton>
            {colorPickerOpen && (
              <ColorPicker
                currentColor={currentColor}
                onSet={(c) => editor?.chain().focus().setColor(c).run()}
                onUnset={() => editor?.chain().focus().unsetColor().run()}
                onClose={() => setColorPickerOpen(false)}
              />
            )}
          </div>
        </div>

        <Sep />

        {/* Alignment */}
        <div className="rich-toolbar-group">
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign("right").run()}
            active={currentAlignment === "right"}
            title="محاذاة لليمين"
          >
            <AlignRightIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign("center").run()}
            active={currentAlignment === "center"}
            title="توسيط"
          >
            <AlignCenterIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign("left").run()}
            active={currentAlignment === "left"}
            title="محاذاة لليسار"
          >
            <AlignLeftIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
            active={currentAlignment === "justify"}
            title="ضبط الهوامش"
          >
            <AlignJustifyIcon />
          </ToolbarButton>
        </div>

        <Sep />

        {/* Superscript / Subscript */}
        <div className="rich-toolbar-group">
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleSuperscript().run()}
            active={editor?.isActive("superscript")}
            title="نص مرتفع"
          >
            <span style={{ fontSize: "0.88rem" }}>
              ع<sup style={{ fontSize: "0.65em" }}>2</sup>
            </span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleSubscript().run()}
            active={editor?.isActive("subscript")}
            title="نص منخفض"
          >
            <span style={{ fontSize: "0.88rem" }}>
              ع<sub style={{ fontSize: "0.65em" }}>2</sub>
            </span>
          </ToolbarButton>
        </div>

        <Sep />

        {/* Link */}
        <div className="rich-toolbar-group">
          <ToolbarButton
            onClick={handleLink}
            active={editor?.isActive("link")}
            title={editor?.isActive("link") ? "إزالة الرابط" : "إضافة رابط"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </ToolbarButton>
        </div>

        <Sep />

        {/* Clear */}
        <div className="rich-toolbar-group">
          <ToolbarButton
            onClick={() =>
              editor?.chain().focus().unsetAllMarks().unsetMark("highlight").run()
            }
            title="حذف كل التنسيق"
          >
            <span className="rich-btn-clear">✕</span>
          </ToolbarButton>
        </div>

        <Sep />

        {/* Undo / Redo */}
        <div className="rich-toolbar-group">
          <ToolbarButton
            onClick={() => editor?.chain().focus().undo().run()}
            title="تراجع (Ctrl+Z)"
          >
            <span style={{ opacity: canUndo ? 1 : 0.35 }}>↩</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().redo().run()}
            title="إعادة (Ctrl+Y)"
          >
            <span style={{ opacity: canRedo ? 1 : 0.35 }}>↪</span>
          </ToolbarButton>
        </div>
      </div>

      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="rich-editor-content rich-editor-loading">
          {value.replace(/<[^>]+>/g, "")}
        </div>
      )}

      {editor && (
        <div className="rich-char-count">
          {charCount} حرف · {wordCount} كلمة
        </div>
      )}
    </div>
  );
}
