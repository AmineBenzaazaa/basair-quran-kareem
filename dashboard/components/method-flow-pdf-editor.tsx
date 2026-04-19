"use client";

import { useEffect, useRef, useState } from "react";

const TOKEN_STORAGE_KEY = "tafsir_dashboard_write_token";

type Props = {
  initialPdfUrl?: string | null;
  writeTokenRequired: boolean;
};

export function MethodFlowPdfEditor({ initialPdfUrl, writeTokenRequired }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialPdfUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [writeToken, setWriteToken] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
      setWriteToken(stored);
    } catch {}
  }, []);

  function authHeaders(): Record<string, string> {
    return writeToken ? { "x-dashboard-token": writeToken } : {};
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      const json = (await res.json()) as {
        pdfUrl?: string;
        paragraphs?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "فشل الرفع");
      setPdfUrl(json.pdfUrl ?? null);
      setSuccess(
        json.paragraphs
          ? `تم رفع الملف واستخراج ${json.paragraphs} فقرة`
          : "تم رفع الملف بنجاح"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء الرفع");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("هل تريد حذف ملف PDF؟ سيعود التطبيق إلى عرض الرسم البياني النصي.")) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/uploads", {
        method: "DELETE",
        headers: authHeaders(),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "فشل الحذف");
      setPdfUrl(null);
      setSuccess("تم حذف الملف");
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء الحذف");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="pdf-editor">
      <div className="pdf-editor-header">
        <h2 className="pdf-editor-title">ملف PDF للرسم البياني</h2>
        <p className="pdf-editor-desc">
          ارفع ملف PDF ليظهر في التطبيق بدلاً من الرسم البياني النصي. عند الحذف يعود التطبيق للعرض النصي.
        </p>
      </div>

      {writeTokenRequired && (
        <div className="pdf-editor-token-row">
          <label className="pdf-editor-label" htmlFor="pdf-write-token">
            رمز الكتابة
          </label>
          <input
            id="pdf-write-token"
            className="pdf-editor-token-input"
            type="password"
            placeholder="أدخل رمز الكتابة"
            value={writeToken}
            onChange={(e) => {
              setWriteToken(e.target.value);
              try { localStorage.setItem(TOKEN_STORAGE_KEY, e.target.value); } catch {}
            }}
          />
        </div>
      )}

      {pdfUrl ? (
        <div className="pdf-editor-current">
          <div className="pdf-editor-file-row">
            <span className="pdf-editor-dot" />
            <span className="pdf-editor-file-label">تم رفع ملف PDF</span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="pdf-editor-preview-link"
            >
              معاينة
            </a>
          </div>
          <div className="pdf-editor-actions">
            <button
              className="pdf-editor-btn pdf-editor-btn-primary"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "جاري الرفع..." : "استبدال الملف"}
            </button>
            <button
              className="pdf-editor-btn pdf-editor-btn-danger"
              disabled={uploading}
              onClick={handleDelete}
            >
              {uploading ? "..." : "حذف الملف"}
            </button>
          </div>
        </div>
      ) : (
        <div className="pdf-editor-empty">
          <div className="pdf-editor-empty-icon">📄</div>
          <p className="pdf-editor-empty-text">لم يتم رفع أي ملف PDF بعد</p>
          <button
            className="pdf-editor-btn pdf-editor-btn-primary"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "جاري الرفع..." : "رفع ملف PDF"}
          </button>
        </div>
      )}

      {error && <p className="pdf-editor-error">{error}</p>}
      {success && <p className="pdf-editor-success">{success}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
