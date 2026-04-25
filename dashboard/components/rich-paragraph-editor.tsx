"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
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
import { UndoRedo } from "@tiptap/extensions";

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

export function RichParagraphEditor({ value, onChange }: Props) {
  const isInternalChange = useRef(false);

  // immediatelyRender: false prevents Tiptap from accessing browser APIs during
  // Next.js server-side rendering.
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
    ],
    content: toEditorContent(value),
    onUpdate({ editor }) {
      isInternalChange.current = true;
      onChange(fromEditorContent(editor.getHTML()));
    },
    editorProps: {
      attributes: {
        dir: "rtl",
        class: "rich-editor-content",
      },
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

  const canUndo = editor?.can().undo() ?? false;
  const canRedo = editor?.can().redo() ?? false;

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" dir="rtl">
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
            title="تمييز النص"
          >
            <span className="rich-btn-highlight">ع</span>
          </ToolbarButton>
        </div>

        <div className="rich-toolbar-sep" />

        <div className="rich-toolbar-group">
          <ToolbarButton
            onClick={() => editor?.chain().focus().unsetAllMarks().unsetMark("highlight").run()}
            title="حذف كل التنسيق"
          >
            <span className="rich-btn-clear">✕</span>
          </ToolbarButton>
        </div>

        <div className="rich-toolbar-sep" />

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
    </div>
  );
}
