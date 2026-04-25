"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { DashboardModule, ModuleDocument } from "../src/lib/content/types";
import { VersesTokenEditor } from "./verses-token-editor";
import { RichParagraphEditor } from "./rich-paragraph-editor";

type DocumentEditorProps = {
  moduleId: string;
  initialDocument?: ModuleDocument | null;
};

type DocumentResponse = {
  item: ModuleDocument;
};

type SurahDocumentEntry = {
  id?: string;
  nameAr?: string;
};

type CollectionDescriptor = {
  key: "root" | string;
  type: "array" | "record";
  items: Array<{
    id: string;
    label: string;
    value: unknown;
  }>;
};

type ParsedDraft =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      error: string;
    };

type FieldEditorProps = {
  label: string;
  value: unknown;
  onChange: (nextValue: unknown) => void;
  depth?: number;
  allowSchemaChanges?: boolean;
  showAdvancedFields?: boolean;
  hideLabel?: boolean;
};

type StructuredLineKind = "heading" | "paragraph";
type PrimitiveListLineKind = StructuredLineKind | "item";

const TOKEN_STORAGE_KEY = "tafsir-dashboard-write-token";
const COLLECTION_KEYS = ["entries", "verses", "cards", "sections"] as const;
const MAX_LIST_ITEMS = 200;
const SIMPLE_HIDDEN_FIELDS = new Set([
  "id",
  "version",
  "order",
  "sourceRefs",
]);
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ok", label: "سليم" },
  { value: "needs_review", label: "بحاجة إلى مراجعة" },
  { value: "missing_source", label: "المصدر مفقود" },
];
const VALID_STATUS_VALUES = new Set(STATUS_OPTIONS.map((option) => option.value));
const REPEATED_ITEM_LABELS: Record<string, string> = {
  paragraphs: "فقرة",
  content: "فقرة",
  bullets: "نقطة",
  examples: "مثال",
  aliases: "اسم بديل",
  keywords: "كلمة مفتاحية",
  variants: "صيغة",
  videoUrls: "رابط فيديو",
  videos: "فيديو",
  cards: "بطاقة",
  sections: "قسم",
  entries: "مدخل",
  tafsirParagraphs: "فقرة تفسير",
  tokens: "كلمة",
};
const LONG_TEXT_LIST_FIELDS = new Set([
  "paragraphs",
  "content",
  "tafsirParagraphs",
  "examples",
]);
const PRIMITIVE_LIST_FIELDS = new Set([
  "paragraphs",
  "content",
  "bullets",
  "examples",
  "aliases",
  "keywords",
  "variants",
  "videoUrls",
  "tafsirParagraphs",
]);
const STRUCTURED_TEXT_FIELDS = new Set(["paragraphs", "content"]);
const FIELD_LABELS: Record<string, string> = {
  id: "المعرف",
  title: "العنوان",
  heading: "العنوان الفرعي",
  description: "الوصف",
  subtitle: "العنوان الثانوي",
  content: "المحتوى",
  paragraphs: "الفقرات",
  cards: "البطاقات",
  sections: "الأقسام",
  bullets: "النقاط",
  examples: "الأمثلة",
  note: "ملاحظة",
  order: "الترتيب",
  phrase: "العبارة",
  variants: "البدائل",
  explanation: "الشرح",
  videoUrls: "روابط الفيديو",
  entries: "المدخلات",
  aliases: "الأسماء البديلة",
  root: "الجذر",
  keywords: "الكلمات المفتاحية",
  defaultParagraphId: "الفقرة الافتراضية",
  related: "مرتبطة بـ",
  videos: "الفيديوهات",
  status: "الحالة",
  url: "الرابط",
  file: "الملف",
  hint: "ملاحظة",
  source: "المصدر",
  sourceRefs: "مراجع المصدر",
  text: "النص",
  surahId: "رقم السورة",
  ayahNumber: "رقم الآية",
  nameAr: "اسم السورة",
  ayahCount: "عدد الآيات",
  textAr: "نص الآية",
  tafsirParagraphs: "فقرات التفسير",
  verses: "الآيات المرتبطة",
  tokens: "الكلمات",
  t: "النص",
  conceptId: "المفهوم",
  paragraphId: "الفقرة",
  style: "النمط",
  version: "الإصدار",
  glossaryEntries: "المفردات",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeDocument(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseDraft(draft: string): ParsedDraft {
  try {
    return {
      ok: true,
      value: JSON.parse(draft) as unknown,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "تعذر قراءة المحتوى.",
    };
  }
}

async function readApiPayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as DocumentResponse | { error?: string };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "تعذر قراءة استجابة الخادم.",
      };
    }
  }

  if (
    response.status === 401 &&
    (response.headers.has("www-authenticate") ||
      contentType.startsWith("text/plain"))
  ) {
    return {
      error: "هذه اللوحة تحتاج تسجيل دخول قبل تحميل المحتوى.",
    };
  }

  const text = (await response.text()).trim();
  if (!text) {
    return { error: "الخادم أعاد استجابة فارغة." };
  }

  if (
    text.startsWith("<!DOCTYPE") ||
    text.startsWith("<html") ||
    text.startsWith("<!doctype")
  ) {
    return {
      error:
        "الخادم أعاد صفحة بدلاً من بيانات القسم. أعد تحميل الصفحة أو أعد تشغيل لوحة التحكم.",
    };
  }

  return { error: text };
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().trim();
}

function getFieldLabel(label: string) {
  return FIELD_LABELS[label] ?? label;
}

function getRepeatedItemLabel(label: string, index: number) {
  const base = REPEATED_ITEM_LABELS[label] ?? "عنصر";
  return `${base} ${index + 1}`;
}

function getCollectionActionLabel(selected: boolean) {
  return selected ? "مفتوح الآن" : "تعديل";
}

function getAddListItemLabel(label: string) {
  const base = REPEATED_ITEM_LABELS[label] ?? "عنصر";

  if (base === "فقرة") return "إضافة فقرة جديدة";
  if (base === "بطاقة") return "إضافة بطاقة جديدة";
  if (base === "قسم") return "إضافة قسم جديد";
  if (base === "مدخل") return "إضافة مدخل جديد";
  if (base === "نقطة") return "إضافة نقطة جديدة";
  if (base === "فقرة تفسير") return "إضافة فقرة تفسير جديدة";

  return `إضافة ${base} جديد`;
}

function getDeleteActionLabel(label: string) {
  if (label === "عنوان") return "حذف العنوان";
  if (label === "فقرة") return "حذف الفقرة";
  return `حذف ${label}`;
}

function isLikelyHeadingText(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (text.length > 42) return false;
  if (text.includes("{") || text.includes("}")) return false;
  if (text.includes("،") || text.includes("؛") || text.includes("؟")) return false;
  if (text.includes(".") || text.includes(":")) return false;
  return true;
}

function inferStructuredLineKind(
  label: string,
  value: string
): PrimitiveListLineKind {
  if (STRUCTURED_TEXT_FIELDS.has(label) && isLikelyHeadingText(value)) {
    return "heading";
  }

  if (STRUCTURED_TEXT_FIELDS.has(label)) {
    return "paragraph";
  }

  return "item";
}

function syncStructuredLineKinds(
  label: string,
  items: unknown[],
  previousKinds: StructuredLineKind[]
) {
  return items.map((item, index) => {
    const inferredKind = inferStructuredLineKind(label, String(item ?? ""));
    return previousKinds[index] ?? (inferredKind === "heading" ? "heading" : "paragraph");
  });
}

function structuredLineKindsMatch(
  currentKinds: StructuredLineKind[],
  nextKinds: StructuredLineKind[]
) {
  return (
    currentKinds.length === nextKinds.length &&
    currentKinds.every((kind, index) => kind === nextKinds[index])
  );
}

function isPrimitiveList(value: unknown[]): value is Array<string | number> {
  return value.every(
    (item) => typeof item === "string" || typeof item === "number"
  );
}

function shouldUsePrimitiveListEditor(label: string, value: unknown[]) {
  if (value.length === 0) {
    return PRIMITIVE_LIST_FIELDS.has(label);
  }

  return isPrimitiveList(value);
}

function isLongListField(label: string, value: string) {
  return LONG_TEXT_LIST_FIELDS.has(label) || value.includes("\n") || value.length > 100;
}

function createEmptyValueFromExample(example: unknown): unknown {
  if (typeof example === "string") return "";
  if (typeof example === "number") return 0;
  if (typeof example === "boolean") return false;
  if (example === null || example === undefined) return "";
  if (Array.isArray(example)) return [];
  if (isRecord(example)) {
    return Object.fromEntries(
      Object.entries(example).map(([key, value]) => [
        key,
        createEmptyValueFromExample(value),
      ])
    );
  }
  return "";
}

function makeInternalKey(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function moveArrayItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function getSmartLabel(value: unknown, key: string, index: number) {
  if (isRecord(value)) {
    if (typeof value.title === "string" && value.title.trim()) return value.title;
    if (typeof value.heading === "string" && value.heading.trim()) return value.heading;
    if (typeof value.phrase === "string" && value.phrase.trim()) return value.phrase;
    if (typeof value.nameAr === "string" && value.nameAr.trim()) return value.nameAr;
    if (typeof value.id === "string" && value.id.trim()) return value.id;
    if (
      typeof value.surahId === "string" &&
      typeof value.ayahNumber === "number"
    ) {
      return `سورة ${value.surahId} - آية ${value.ayahNumber}`;
    }
    if (typeof value.ruleNumber === "number") {
      return `القاعدة ${value.ruleNumber}`;
    }
    if (key === "sections") {
      const paragraphSource = Array.isArray(value.paragraphs)
        ? value.paragraphs
        : Array.isArray(value.content)
          ? value.content
          : [];
      const firstHeading = paragraphSource.find(
        (item) =>
          typeof item === "string" && item.trim() && isLikelyHeadingText(item.trim())
      );
      if (typeof firstHeading === "string") {
        return firstHeading;
      }
      const firstParagraph = paragraphSource.find(
        (item) => typeof item === "string" && item.trim()
      );
      if (typeof firstParagraph === "string") {
        return firstParagraph.slice(0, 48);
      }
      return `القسم ${index + 1}`;
    }
  }

  if (typeof value === "string" && value.trim()) {
    return value.slice(0, 56);
  }

  if (key !== "root") {
    return key;
  }

  return `العنصر ${index + 1}`;
}

function detectCollection(document: unknown): CollectionDescriptor | null {
  if (Array.isArray(document)) {
    return {
      key: "root",
      type: "array",
      items: document.map((item, index) => ({
        id: String(index),
        label: getSmartLabel(item, "root", index),
        value: item,
      })),
    };
  }

  if (!isRecord(document)) {
    return null;
  }

  for (const key of COLLECTION_KEYS) {
    const value = document[key];
    if (Array.isArray(value)) {
      return {
        key,
        type: "array",
        items: value.map((item, index) => ({
          id: String(index),
          label: getSmartLabel(item, key, index),
          value: item,
        })),
      };
    }
    if (isRecord(value)) {
      return {
        key,
        type: "record",
        items: Object.entries(value).map(([entryKey, entryValue], index) => ({
          id: entryKey,
          label: getSmartLabel(entryValue, entryKey, index),
          value: entryValue,
        })),
      };
    }
  }

  return null;
}

function getDefaultSelectedId(document: unknown) {
  return detectCollection(document)?.items[0]?.id ?? "";
}

function getNextSelectedIdAfterDelete(
  items: CollectionDescriptor["items"],
  deletedId: string
) {
  const index = items.findIndex((item) => item.id === deletedId);
  if (index < 0) {
    return items[0]?.id ?? "";
  }

  return items[index + 1]?.id ?? items[index - 1]?.id ?? "";
}

function replaceCollectionItem(
  document: unknown,
  collection: CollectionDescriptor,
  itemId: string,
  nextValue: unknown
) {
  if (collection.key === "root") {
    if (collection.type === "array" && Array.isArray(document)) {
      const index = Number(itemId);
      return document.map((item, itemIndex) =>
        itemIndex === index ? nextValue : item
      );
    }
    if (collection.type === "record" && isRecord(document)) {
      return {
        ...document,
        [itemId]: nextValue,
      };
    }
    return document;
  }

  if (!isRecord(document)) {
    return document;
  }

  const currentCollection = document[collection.key];

  if (collection.type === "array" && Array.isArray(currentCollection)) {
    const index = Number(itemId);
    return {
      ...document,
      [collection.key]: currentCollection.map((item, itemIndex) =>
        itemIndex === index ? nextValue : item
      ),
    };
  }

  if (collection.type === "record" && isRecord(currentCollection)) {
    return {
      ...document,
      [collection.key]: {
        ...currentCollection,
        [itemId]: nextValue,
      },
    };
  }

  return document;
}

function deleteCollectionItem(
  document: unknown,
  collection: CollectionDescriptor,
  itemId: string
) {
  if (collection.key === "root") {
    if (collection.type === "array" && Array.isArray(document)) {
      const index = Number(itemId);
      return document.filter((_, itemIndex) => itemIndex !== index);
    }
    if (collection.type === "record" && isRecord(document)) {
      const next = { ...document };
      delete next[itemId];
      return next;
    }
    return document;
  }

  if (!isRecord(document)) {
    return document;
  }

  const currentCollection = document[collection.key];

  if (collection.type === "array" && Array.isArray(currentCollection)) {
    const index = Number(itemId);
    return {
      ...document,
      [collection.key]: currentCollection.filter((_, itemIndex) => itemIndex !== index),
    };
  }

  if (collection.type === "record" && isRecord(currentCollection)) {
    const nextCollection = { ...currentCollection };
    delete nextCollection[itemId];
    return {
      ...document,
      [collection.key]: nextCollection,
    };
  }

  return document;
}

function buildAddedCollectionItem(
  document: unknown,
  collection: CollectionDescriptor,
  newKey: string | null
) {
  const currentSource =
    collection.key === "root" && collection.type === "array"
      ? document
      : collection.key === "root" && collection.type === "record"
        ? document
        : isRecord(document)
          ? document[collection.key]
          : null;

  const example =
    collection.type === "array" && Array.isArray(currentSource)
      ? currentSource[0]
      : collection.type === "record" && isRecord(currentSource)
        ? Object.values(currentSource)[0]
        : undefined;

  const generatedKey = newKey ?? makeInternalKey(collection.key);
  const nextValueBase = createEmptyValueFromExample(example);
  const nextValue =
    isRecord(nextValueBase) && isRecord(example) && "id" in example
      ? {
          ...nextValueBase,
          id: generatedKey,
        }
      : nextValueBase;

  if (collection.key === "root") {
    if (collection.type === "array" && Array.isArray(document)) {
      return {
        document: [...document, nextValue],
        selectedId: String(document.length),
      };
    }

    if (collection.type === "record" && isRecord(document)) {
      return {
        document: {
          ...document,
          [generatedKey]: nextValue,
        },
        selectedId: generatedKey,
      };
    }

    return null;
  }

  if (!isRecord(document)) {
    return null;
  }

  const currentCollection = document[collection.key];

  if (collection.type === "array" && Array.isArray(currentCollection)) {
    return {
      document: {
        ...document,
        [collection.key]: [...currentCollection, nextValue],
      },
      selectedId: String(currentCollection.length),
    };
  }

  if (collection.type === "record" && isRecord(currentCollection)) {
    return {
      document: {
        ...document,
        [collection.key]: {
          ...currentCollection,
          [generatedKey]: nextValue,
        },
      },
      selectedId: generatedKey,
    };
  }

  return null;
}

function StructuredFieldEditor({
  label,
  value,
  onChange,
  depth = 0,
  allowSchemaChanges = false,
  showAdvancedFields = false,
  hideLabel = false,
}: FieldEditorProps) {
  const isLongText =
    typeof value === "string" && (value.includes("\n") || value.length > 100);
  const isPrimitiveListValue =
    Array.isArray(value) && shouldUsePrimitiveListEditor(label, value);
  const supportsHeadingItems =
    isPrimitiveListValue && STRUCTURED_TEXT_FIELDS.has(label);
  const [structuredLineKinds, setStructuredLineKinds] = useState<
    StructuredLineKind[]
  >([]);

  useEffect(() => {
    if (!supportsHeadingItems || !Array.isArray(value)) {
      setStructuredLineKinds((currentKinds) =>
        currentKinds.length === 0 ? currentKinds : []
      );
      return;
    }

    setStructuredLineKinds((currentKinds) => {
      const nextKinds = syncStructuredLineKinds(label, value, currentKinds);
      return structuredLineKindsMatch(currentKinds, nextKinds)
        ? currentKinds
        : nextKinds;
    });
  }, [label, supportsHeadingItems, value]);

  if (label === "status" && typeof value === "string") {
    const normalizedValue = VALID_STATUS_VALUES.has(value)
      ? value
      : value === "published"
        ? "ok"
        : value === "missingSource"
          ? "missing_source"
          : "needs_review";

    return (
      <div className="field-block">
        {!hideLabel && <label className="field-label">{getFieldLabel(label)}</label>}
        <select
          className="field-input"
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (typeof value === "string") {
    return (
      <div className="field-block">
        {!hideLabel && <label className="field-label">{getFieldLabel(label)}</label>}
        {isLongText ? (
          <textarea
            className="field-textarea"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            className="field-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div className="field-block">
        {!hideLabel && <label className="field-label">{getFieldLabel(label)}</label>}
        <input
          className="field-input"
          type="number"
          value={Number.isFinite(value) ? value : ""}
          onChange={(event) => onChange(Number(event.target.value || 0))}
        />
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <div className="field-block">
        {!hideLabel && <label className="field-label">{getFieldLabel(label)}</label>}
        <select
          className="field-input"
          value={value ? "true" : "false"}
          onChange={(event) => onChange(event.target.value === "true")}
        >
          <option value="true">نعم</option>
          <option value="false">لا</option>
        </select>
      </div>
    );
  }

  if (value === null || value === undefined) {
    return (
      <div className="field-block">
        {!hideLabel && <label className="field-label">{getFieldLabel(label)}</label>}
        <input
          className="field-input"
          value=""
          placeholder="أدخل قيمة"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (isPrimitiveListValue) {
      return (
        <div className="field-block">
          <div className="field-header">
            {!hideLabel && <label className="field-label">{getFieldLabel(label)}</label>}
            <div className="field-header-actions">
              {supportsHeadingItems ? (
                <button
                  className="mini-button"
                  type="button"
                  onClick={() => {
                    setStructuredLineKinds((currentKinds) => [
                      ...currentKinds,
                      "heading",
                    ]);
                    onChange([...value, "عنوان جديد"]);
                  }}
                >
                  إضافة عنوان جديد
                </button>
              ) : null}
              <button
                className="mini-button"
                type="button"
                onClick={() => {
                  if (supportsHeadingItems) {
                    setStructuredLineKinds((currentKinds) => [
                      ...currentKinds,
                      "paragraph",
                    ]);
                  }
                  onChange([...value, ""]);
                }}
              >
                {supportsHeadingItems
                  ? "إضافة فقرة جديدة"
                  : getAddListItemLabel(label)}
              </button>
            </div>
          </div>

          <div className="field-array">
            {value.length === 0 ? (
              <div className="field-card empty-card">لا توجد عناصر حالياً.</div>
          ) : (
            value.map((item, index) => {
                const textValue = String(item ?? "");
                const lineKind = supportsHeadingItems
                  ? structuredLineKinds[index] ?? inferStructuredLineKind(label, textValue)
                  : inferStructuredLineKind(label, textValue);
                const useTextarea =
                  lineKind === "paragraph" ||
                  (typeof item === "string" && isLongListField(label, textValue));

                const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  onChange(
                    value.map((currentItem, itemIndex) =>
                      itemIndex === index
                        ? typeof currentItem === "number"
                          ? Number(event.target.value || 0)
                          : event.target.value
                        : currentItem
                    )
                  );

                const handleDelete = () => {
                  if (supportsHeadingItems) {
                    setStructuredLineKinds((currentKinds) =>
                      currentKinds.filter((_, kindIndex) => kindIndex !== index)
                    );
                  }
                  onChange(value.filter((_, itemIndex) => itemIndex !== index));
                };

                const handleMoveUp = () => {
                  if (index === 0) return;
                  if (supportsHeadingItems) {
                    setStructuredLineKinds((k) => moveArrayItem(k, index, index - 1));
                  }
                  onChange(moveArrayItem(value, index, index - 1));
                };

                const handleMoveDown = () => {
                  if (index === value.length - 1) return;
                  if (supportsHeadingItems) {
                    setStructuredLineKinds((k) => moveArrayItem(k, index, index + 1));
                  }
                  onChange(moveArrayItem(value, index, index + 1));
                };

                const handleLineKindChange = (nextKind: StructuredLineKind) => {
                  if (!supportsHeadingItems) {
                    return;
                  }

                  setStructuredLineKinds((currentKinds) =>
                    currentKinds.map((kind, kindIndex) =>
                      kindIndex === index ? nextKind : kind
                    )
                  );
                };

                if (lineKind === "paragraph") {
                  return (
                    <div className="para-row" key={`${depth}-${index}`}>
                      <div className="field-actions">
                        <strong>{getRepeatedItemLabel(label, index)}</strong>
                        <div className="field-header-actions">
                          <div className="sort-controls">
                            <button
                              className="sort-btn"
                              type="button"
                              disabled={index === 0}
                              onClick={handleMoveUp}
                              title="تحريك لأعلى"
                            >↑</button>
                            <button
                              className="sort-btn"
                              type="button"
                              disabled={index === value.length - 1}
                              onClick={handleMoveDown}
                              title="تحريك لأسفل"
                            >↓</button>
                          </div>
                          {supportsHeadingItems ? (
                            <button
                              className="mini-button"
                              type="button"
                              onClick={() => handleLineKindChange("heading")}
                            >
                              تحويل إلى عنوان
                            </button>
                          ) : null}
                          <button
                            className="para-delete"
                            type="button"
                            title="حذف الفقرة"
                            onClick={handleDelete}
                          >
                            إزالة
                          </button>
                        </div>
                      </div>
                      <RichParagraphEditor
                        value={textValue}
                        onChange={(html) =>
                          onChange(
                            value.map((currentItem, itemIndex) =>
                              itemIndex === index ? html : currentItem
                            )
                          )
                        }
                      />
                    </div>
                  );
                }

                return (
                  <div
                    className={`field-card ${lineKind === "heading" ? "heading-card" : ""}`}
                    key={`${depth}-${index}`}
                  >
                    <div className="field-actions">
                      <strong>
                        {lineKind === "heading"
                          ? "عنوان"
                          : getRepeatedItemLabel(label, index)}
                      </strong>
                      <div className="field-header-actions">
                        <div className="sort-controls">
                          <button
                            className="sort-btn"
                            type="button"
                            disabled={index === 0}
                            onClick={handleMoveUp}
                            title="تحريك لأعلى"
                          >↑</button>
                          <button
                            className="sort-btn"
                            type="button"
                            disabled={index === value.length - 1}
                            onClick={handleMoveDown}
                            title="تحريك لأسفل"
                          >↓</button>
                        </div>
                        {supportsHeadingItems ? (
                          <button
                            className="mini-button"
                            type="button"
                            onClick={() => handleLineKindChange("paragraph")}
                          >
                            تحويل إلى فقرة
                          </button>
                        ) : null}
                        <button
                          className="mini-button danger"
                          type="button"
                          onClick={handleDelete}
                        >
                          {lineKind === "heading"
                            ? "حذف العنوان"
                            : getDeleteActionLabel(REPEATED_ITEM_LABELS[label] ?? "العنصر")}
                        </button>
                      </div>
                    </div>

                    {useTextarea && LONG_TEXT_LIST_FIELDS.has(label) ? (
                      <RichParagraphEditor
                        value={textValue}
                        onChange={(html) =>
                          onChange(
                            value.map((currentItem, itemIndex) =>
                              itemIndex === index ? html : currentItem
                            )
                          )
                        }
                      />
                    ) : useTextarea ? (
                      <textarea
                        className="field-textarea"
                        value={textValue}
                        onChange={handleChange}
                      />
                    ) : (
                      <input
                        className={`field-input ${lineKind === "heading" ? "heading-input" : ""}`}
                        value={textValue}
                        onChange={handleChange}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="field-block">
        <div className="field-header">
          {!hideLabel && <label className="field-label">{getFieldLabel(label)}</label>}
          <button
            className="mini-button"
            type="button"
            onClick={() => onChange([...value, createEmptyValueFromExample(value[0])])}
          >
            {getAddListItemLabel(label)}
          </button>
        </div>

        <div className="field-array">
          {value.length === 0 ? (
            <div className="field-card empty-card">لا توجد عناصر حالياً.</div>
          ) : (
            value.map((item, index) => (
              <div className="field-card" key={`${depth}-${index}`}>
                <div className="field-actions">
                  <strong>{getRepeatedItemLabel(label, index)}</strong>
                  <div className="field-header-actions">
                    <div className="sort-controls">
                      <button
                        className="sort-btn"
                        type="button"
                        disabled={index === 0}
                        onClick={() => onChange(moveArrayItem(value, index, index - 1))}
                        title="تحريك لأعلى"
                      >↑</button>
                      <button
                        className="sort-btn"
                        type="button"
                        disabled={index === value.length - 1}
                        onClick={() => onChange(moveArrayItem(value, index, index + 1))}
                        title="تحريك لأسفل"
                      >↓</button>
                    </div>
                    <button
                      className="mini-button danger"
                      type="button"
                      onClick={() =>
                        onChange(value.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      {getDeleteActionLabel(REPEATED_ITEM_LABELS[label] ?? "العنصر")}
                    </button>
                  </div>
                </div>

                <StructuredFieldEditor
                  depth={depth + 1}
                  label={`${label} ${index + 1}`}
                  value={item}
                  allowSchemaChanges={false}
                  showAdvancedFields={showAdvancedFields}
                  hideLabel={true}
                  onChange={(nextItem) =>
                    onChange(
                      value.map((currentItem, itemIndex) =>
                        itemIndex === index ? nextItem : currentItem
                      )
                    )
                  }
                />
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([entryKey]) => {
      return showAdvancedFields || !SIMPLE_HIDDEN_FIELDS.has(entryKey);
    });

    return (
      <div className="field-block">
        {!hideLabel && (
          <div className="field-header">
            <label className="field-label">{getFieldLabel(label)}</label>
          </div>
        )}

        <div className="field-grid">
          {entries.length === 0 ? (
            <div className="field-card empty-card">لا توجد حقول داخل هذا القسم.</div>
          ) : (
            entries.map(([entryKey, entryValue]) => (
              <div className="field-card" key={`${depth}-${entryKey}`}>
                <div className="field-actions">
                  <strong>{getFieldLabel(entryKey)}</strong>
                  {allowSchemaChanges ? (
                    <button
                      className="mini-button danger"
                      type="button"
                      onClick={() => {
                        const nextValue = { ...value };
                        delete nextValue[entryKey];
                        onChange(nextValue);
                      }}
                    >
                      حذف هذا الحقل
                    </button>
                  ) : null}
                </div>

                <StructuredFieldEditor
                  depth={depth + 1}
                  label={entryKey}
                  value={entryValue}
                  allowSchemaChanges={allowSchemaChanges}
                  showAdvancedFields={showAdvancedFields}
                  hideLabel={true}
                  onChange={(nextEntryValue) =>
                    onChange({
                      ...value,
                      [entryKey]: nextEntryValue,
                    })
                  }
                />
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return null;
}

export function DocumentEditor({
  moduleId,
  initialDocument = null,
}: DocumentEditorProps) {
  const [serverDocument, setServerDocument] = useState<ModuleDocument | null>(
    initialDocument
  );
  const [documentValue, setDocumentValue] = useState<unknown>(
    initialDocument?.document
  );
  const [jsonDraft, setJsonDraft] = useState("");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"success" | "error" | "idle">(
    "idle"
  );
  const [surahNames, setSurahNames] = useState<Record<string, string>>({});
  const [writeToken, setWriteToken] = useState("");
  const [mode, setMode] = useState<"guided" | "json">("guided");
  const [search, setSearch] = useState("");
  const [surahFilter, setSurahFilter] = useState("");
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [ayahText, setAyahText] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(
    initialDocument ? getDefaultSelectedId(initialDocument.document) : ""
  );
  const [dirty, setDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialDocument);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    setWriteToken(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(TOKEN_STORAGE_KEY, writeToken);
  }, [writeToken]);

  useEffect(() => {
    if (!initialDocument) {
      return;
    }

    setServerDocument(initialDocument);
    setDocumentValue(initialDocument.document);
    setJsonDraft("");
    setDirty(false);
    setSearch("");
    setSelectedId(getDefaultSelectedId(initialDocument.document));
    setShowAdvancedTools(false);
    setStatus("");
    setStatusTone("idle");
    setIsLoading(false);
  }, [initialDocument]);

  useEffect(() => {
    let cancelled = false;

    async function loadSurahNames() {
      try {
        const response = await fetch("/api/content/surahs", {
          cache: "no-store",
        });
        const payload = await readApiPayload(response);

        if (
          cancelled ||
          !response.ok ||
          !("item" in payload) ||
          !Array.isArray(payload.item.document)
        ) {
          return;
        }

        const nextNames = Object.fromEntries(
          (payload.item.document as SurahDocumentEntry[])
            .filter(
              (entry): entry is { id: string; nameAr: string } =>
                typeof entry.id === "string" && typeof entry.nameAr === "string"
            )
            .map((entry) => [entry.id, entry.nameAr])
        );

        setSurahNames(nextNames);
      } catch {
        if (!cancelled) {
          setSurahNames({});
        }
      }
    }

    void loadSurahNames();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reloadNonce === 0 && initialDocument) {
      return;
    }

    let cancelled = false;

    async function loadDocument() {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/content/${moduleId}`, {
          cache: "no-store",
        });
        const payload = await readApiPayload(response);

        if (cancelled) {
          return;
        }

        if (!response.ok || !("item" in payload)) {
          setStatus(
            "error" in payload
              ? payload.error ?? "تعذر تحميل المحتوى."
              : "تعذر تحميل المحتوى."
          );
          setStatusTone("error");
          setIsLoading(false);
          return;
        }

        setServerDocument(payload.item);
        setDocumentValue(payload.item.document);
        setJsonDraft("");
        setDirty(false);
        setSearch("");
        setSelectedId(getDefaultSelectedId(payload.item.document));
        setShowAdvancedTools(false);
        setStatus("");
        setStatusTone("idle");
        setIsLoading(false);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus(
          error instanceof Error ? error.message : "تعذر تحميل المحتوى."
        );
        setStatusTone("error");
        setIsLoading(false);
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [initialDocument, moduleId, reloadNonce]);

  const collection = useMemo(
    () => (documentValue === undefined ? null : detectCollection(documentValue)),
    [documentValue]
  );

  const filteredItems = useMemo(() => {
    if (!collection) {
      return [];
    }

    const query = normalizeSearchText(search);
    const items = collection.items.filter((item) => {
      if (surahFilter) {
        const val = item.value as Record<string, unknown> | null;
        if (!val || String(val.surahId) !== surahFilter) return false;
      }
      if (!query) return true;
      return normalizeSearchText(`${item.label} ${item.id}`).includes(query);
    });

    return items.slice(0, MAX_LIST_ITEMS);
  }, [collection, search, surahFilter]);

  useEffect(() => {
    if (!collection || collection.items.length === 0) {
      setSelectedId("");
      return;
    }

    const availableIds = new Set(collection.items.map((item) => item.id));
    if (!selectedId || !availableIds.has(selectedId)) {
      setSelectedId(collection.items[0].id);
    }
  }, [collection, selectedId]);

  useEffect(() => {
    if (!filteredItems.length) {
      return;
    }

    if (!filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) ?? null,
    [filteredItems, selectedId]
  );

  // Sync bulk range + fetch ayah text when a tafsir item is selected
  useEffect(() => {
    if (serverDocument?.module?.id !== "tafsir" || !selectedItem) return;
    const val = selectedItem.value as Record<string, unknown> | null;
    const ayah = val ? String(val.ayahNumber ?? "") : "";
    setBulkFrom(ayah);
    setBulkTo(ayah);
    setAyahText(null);
    if (!val?.surahId || !val?.ayahNumber) return;
    fetch(`/api/ayah?surahId=${val.surahId}&ayahNumber=${val.ayahNumber}`)
      .then((r) => r.json())
      .then((data: { textAr?: string }) => { if (data.textAr) setAyahText(data.textAr); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem?.id, serverDocument?.module?.id]);

  const handleBulkApplyTafsir = () => {
    if (!selectedItem || !collection || documentValue === undefined) return;
    const val = selectedItem.value as Record<string, unknown> | null;
    if (!val) return;
    const surahId = String(val.surahId ?? "");
    const from = parseInt(bulkFrom, 10);
    const to = parseInt(bulkTo, 10);
    if (!surahId || isNaN(from) || isNaN(to) || from > to) return;
    const tafsirParagraphs = val.tafsirParagraphs;

    const updatedArray = (documentValue as unknown[]).map((entry) => {
      const e = entry as Record<string, unknown>;
      const n = Number(e.ayahNumber);
      if (String(e.surahId) === surahId && n >= from && n <= to) {
        return { ...e, tafsirParagraphs };
      }
      return entry;
    });
    updateStructuredDocument(updatedArray);
    setStatus(`تم تطبيق التفسير على الآيات ${from}–${to} من السورة.`);
    setStatusTone("success");
  };

  const parsedJsonDraft = useMemo(() => {
    if (mode !== "json") {
      return null;
    }
    return parseDraft(jsonDraft);
  }, [jsonDraft, mode]);

  const currentModule: DashboardModule | null = serverDocument?.module ?? null;
  const itemLabel = currentModule?.itemLabel ?? "عنصر";
  const addActionLabel = currentModule?.addActionLabel ?? "إضافة عنصر جديد";
  const searchPlaceholder = currentModule?.searchPlaceholder ?? "ابحث داخل العناصر";

  const applyResponse = (item: ModuleDocument, message: string) => {
    setServerDocument(item);
    setDocumentValue(item.document);
    setJsonDraft(mode === "json" ? serializeDocument(item.document) : "");
    setDirty(false);
    setStatus(message);
    setStatusTone("success");
  };

  const updateStructuredDocument = (nextValue: unknown) => {
    setDocumentValue(nextValue);
    setDirty(true);
    setStatus("");
    setStatusTone("idle");
  };

  const openJsonMode = () => {
    if (documentValue === undefined) {
      return;
    }

    setJsonDraft(serializeDocument(documentValue));
    setShowAdvancedTools(true);
    setMode("json");
    setStatus("");
    setStatusTone("idle");
  };

  const openGuidedMode = () => {
    if (mode !== "json") {
      setMode("guided");
      return;
    }

    const result = parseDraft(jsonDraft);
    if (!result.ok) {
      setStatus("لا يمكن العودة إلى الوضع المبسط قبل تصحيح JSON.");
      setStatusTone("error");
      return;
    }

    setDocumentValue(result.value);
    setMode("guided");
    setStatus("");
    setStatusTone("idle");
  };

  const handleSave = () => {
    if (!serverDocument) {
      return;
    }

    let documentToSave = documentValue;

    if (mode === "json") {
      const result = parseDraft(jsonDraft);
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      documentToSave = result.value;
    }

    if (documentToSave === undefined) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/content/${serverDocument.module.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(writeToken ? { "x-dashboard-token": writeToken } : {}),
        },
        body: JSON.stringify({ document: documentToSave }),
      });
      const payload = await readApiPayload(response);

      if (!response.ok || !("item" in payload)) {
        setStatus(
          "error" in payload
            ? payload.error ?? "تعذر حفظ التعديلات."
            : "تعذر حفظ التعديلات."
        );
        setStatusTone("error");
        return;
      }

      applyResponse(payload.item, "تم حفظ التعديلات بنجاح.");
    });
  };

  const handleReset = () => {
    if (!serverDocument) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(
        `/api/content/${serverDocument.module.id}/reset`,
        {
          method: "POST",
          headers: writeToken ? { "x-dashboard-token": writeToken } : {},
        }
      );
      const payload = await readApiPayload(response);

      if (!response.ok || !("item" in payload)) {
        setStatus(
          "error" in payload
            ? payload.error ?? "تعذر إعادة الضبط."
            : "تعذر إعادة الضبط."
        );
        setStatusTone("error");
        return;
      }

      applyResponse(payload.item, "تمت إعادة المحتوى إلى النسخة الابتدائية.");
    });
  };

  const handleFormatJson = () => {
    const result = parseDraft(jsonDraft);
    if (!result.ok) {
      setStatus(result.error);
      setStatusTone("error");
      return;
    }

    setJsonDraft(serializeDocument(result.value));
    setDirty(true);
    setStatus("تم ترتيب JSON بشكل منسق.");
    setStatusTone("success");
  };

  const handleUpdateSelectedItem = (nextValue: unknown) => {
    if (documentValue === undefined || !collection || !selectedItem) {
      return;
    }

    updateStructuredDocument(
      replaceCollectionItem(documentValue, collection, selectedItem.id, nextValue)
    );
  };

  const handleDeleteCollectionItem = (itemId: string) => {
    if (documentValue === undefined || !collection) {
      return;
    }

    const itemToDelete = collection.items.find((item) => item.id === itemId);
    if (!itemToDelete) {
      return;
    }

    setConfirmDialog({
      message: `سيتم حذف ${itemLabel} التالي نهائياً:\n«${itemToDelete.label}»\n\nهل تريد المتابعة؟`,
      onConfirm: () => {
        setConfirmDialog(null);
        const nextSelectedId = getNextSelectedIdAfterDelete(collection.items, itemId);
        updateStructuredDocument(
          deleteCollectionItem(documentValue, collection, itemId)
        );
        setSelectedId(nextSelectedId);
        setStatus(`تم حذف ${itemLabel}: ${itemToDelete.label}`);
        setStatusTone("success");
      },
    });
  };

  const handleDeleteSelectedItem = () => {
    if (!selectedItem) {
      return;
    }

    handleDeleteCollectionItem(selectedItem.id);
  };

  const handleAddCollectionItem = () => {
    if (documentValue === undefined || !collection) {
      return;
    }

    const next = buildAddedCollectionItem(
      documentValue,
      collection,
      null
    );
    if (!next) {
      return;
    }

    updateStructuredDocument(next.document);
    setSelectedId(next.selectedId);
    setStatus(`تمت إضافة ${itemLabel} جديد وفتحه للتعديل.`);
    setStatusTone("success");
  };

  const handleUpdateMeta = (nextMeta: unknown) => {
    if (
      documentValue === undefined ||
      !collection ||
      collection.key === "root" ||
      !isRecord(documentValue) ||
      !isRecord(nextMeta)
    ) {
      return;
    }

    updateStructuredDocument({
      ...nextMeta,
      [collection.key]: documentValue[collection.key],
    });
  };

  const metaValue =
    collection &&
    collection.key !== "root" &&
    isRecord(documentValue)
      ? Object.fromEntries(
          Object.entries(documentValue).filter(([key]) => key !== collection.key)
        )
      : null;

  // Special editor for verses-tokens module
  const isVersesTokensModule = serverDocument?.module.id === "verses-tokens";

  const handleVersesTokensSave = useCallback(
    async (data: unknown) => {
      if (!serverDocument) return;

      setSaving(true);
      try {
        const response = await fetch(`/api/content/${serverDocument.module.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(writeToken ? { "x-dashboard-token": writeToken } : {}),
          },
          body: JSON.stringify({ document: data }),
        });
        const payload = await readApiPayload(response);

        if (!response.ok || !("item" in payload)) {
          throw new Error("error" in payload ? payload.error : "فشل الحفظ");
        }

        applyResponse(payload.item, "تم حفظ التعديلات بنجاح.");
      } catch (error) {
        console.error("Save error:", error);
      } finally {
        setSaving(false);
      }
    },
    [serverDocument, writeToken]
  );

  if (isVersesTokensModule && documentValue) {
    return (
      <VersesTokenEditor
        initialData={documentValue as any}
        onSave={handleVersesTokensSave}
      />
    );
  }

  if (isLoading && !serverDocument) {
    return (
      <div className="field-card empty-card">
        <strong>جاري تحميل المحتوى</strong>
        <p>يتم تجهيز الحقول المناسبة لهذا القسم.</p>
      </div>
    );
  }

  if (!serverDocument || documentValue === undefined) {
    return (
      <div className="field-card empty-card">
        <strong>تعذر تحميل القسم</strong>
        <p>{status || "حاول إعادة التحميل مرة أخرى."}</p>
        <button
          className="button-ghost"
          type="button"
          onClick={() => setReloadNonce((value) => value + 1)}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (currentModule?.readOnly) {
    return (
      <div className="panel padded readonly-panel">
        <div className="section-heading compact">
          <h2>{currentModule.title}</h2>
          <p>هذا المحتوى للقراءة فقط ولا يمكن تعديله من هنا.</p>
        </div>
        <div className="field-helper">
          البيانات الواردة في هذا القسم ({currentModule.description}) محددة مسبقاً ولا تتطلب
          تعديلاً يدوياً من لوحة التحكم.
        </div>
      </div>
    );
  }

  return (
    <div className="editor-shell">
      <div className="editor-actions primary-actions">
        <button className="button" disabled={isPending || !dirty} onClick={handleSave}>
          {isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
        </button>
        {serverDocument.resetSupported ? (
          <button className="button-link" disabled={isPending} onClick={handleReset}>
            استرجاع النسخة الأصلية
          </button>
        ) : null}
      </div>

      <div
        className={`editor-status ${
          statusTone === "success"
            ? "success"
            : statusTone === "error"
              ? "error"
              : ""
        }`}
      >
        {status}
      </div>

      {serverDocument.writeTokenRequired ? (
        <label className="info-box">
          <strong>رمز السماح بالحفظ</strong>
          <input
            className="token-input"
            type="password"
            value={writeToken}
            onChange={(event) => setWriteToken(event.target.value)}
            placeholder="أدخل رمز الحفظ"
          />
        </label>
      ) : null}

      {dirty ? (
        <div className="unsaved-banner">
          لديك تغييرات لم تُحفظ بعد
        </div>
      ) : null}

      {showAdvancedTools || mode === "json" ? (
        <div className="advanced-panel">
          <div className="section-heading compact">
            <h2>خيارات متقدمة</h2>
            <p>يمكن تجاهل هذا الجزء في الاستخدام العادي.</p>
          </div>
          <div className="editor-mode-row">
            <button
              className={`mode-button ${mode === "guided" ? "active" : ""}`}
              type="button"
              onClick={openGuidedMode}
            >
              التعديل العادي
            </button>
            <button
              className={`mode-button ${mode === "json" ? "active" : ""}`}
              type="button"
              onClick={openJsonMode}
            >
              تعديل JSON
            </button>
          </div>
        </div>
      ) : null}

      {mode === "json" ? (
        <>
          <div className="editor-actions">
            <button className="button-ghost" type="button" onClick={handleFormatJson}>
              تنسيق JSON
            </button>
          </div>
          <textarea
            className="json-textarea"
            spellCheck={false}
            value={jsonDraft}
            onChange={(event) => {
              setJsonDraft(event.target.value);
              setDirty(true);
              setStatus("");
              setStatusTone("idle");
            }}
          />
          {parsedJsonDraft && !parsedJsonDraft.ok ? (
            <div className="field-helper">{parsedJsonDraft.error}</div>
          ) : null}
        </>
      ) : collection ? (
        <div className="guided-layout">
          {metaValue && isRecord(metaValue) && Object.keys(metaValue).length > 0 ? (
            <div className="panel padded">
              <StructuredFieldEditor
                key={`meta-${currentModule?.id ?? moduleId}-${collection.key}`}
                label="بيانات القسم"
                value={metaValue}
                onChange={handleUpdateMeta}
                showAdvancedFields={showAdvancedTools}
              />
            </div>
          ) : null}

          <div className="collection-layout">
            <div className="panel padded collection-sidebar">
              <div className="collection-toolbar">
                {currentModule?.id === "tafsir" ? (
                  <div className="tafsir-filters">
                    <select
                      className="field-input"
                      value={surahFilter}
                      onChange={(e) => { setSurahFilter(e.target.value); setSearch(""); }}
                    >
                      <option value="">كل السور</option>
                      {Array.from({ length: 114 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={String(n)}>
                          {n}. {surahNames[String(n)] ?? ""}
                        </option>
                      ))}
                    </select>
                    <input
                      className="field-input"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="رقم الآية"
                      type="number"
                      min={1}
                    />
                  </div>
                ) : (
                  <input
                    className="field-input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={searchPlaceholder}
                  />
                )}
                <button className="button-ghost add-button" type="button" onClick={handleAddCollectionItem}>
                  {addActionLabel}
                </button>
              </div>

              <div className="collection-items">
                {filteredItems.length === 0 ? (
                  <div className="sidebar-empty">لا توجد نتائج.</div>
                ) : (
                  filteredItems.map((item) => {
                    const sidebarLabel = currentModule?.id === "tafsir"
                      ? (() => {
                          const v = item.value as Record<string, unknown> | null;
                          const name = v
                            ? (surahNames[String(v.surahId)] ?? `سورة ${v.surahId}`)
                            : item.label;
                          return `${name} - آية ${(v?.ayahNumber as number) ?? ""}`;
                        })()
                      : item.label;
                    return (
                    <div
                      key={item.id}
                      className={`sidebar-row ${item.id === selectedId ? "selected" : ""}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className="sidebar-row-label">{sidebarLabel}</span>
                      {item.id === selectedId ? (
                        <button
                          className="sidebar-delete-btn"
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteCollectionItem(item.id); }}
                        >
                          إزالة
                        </button>
                      ) : null}
                    </div>
                    );
                  })
                )}
              </div>

              {collection.items.length > MAX_LIST_ITEMS ? (
                <div className="field-helper">
                  يتم عرض أول {MAX_LIST_ITEMS.toLocaleString("ar-EG")} نتيجة. استخدم البحث للوصول السريع.
                </div>
              ) : null}
            </div>

            <div className="panel padded">
              {selectedItem ? (
                <>
                  {currentModule?.id === "tafsir" ? (() => {
                    const val = selectedItem.value as Record<string, unknown>;
                    const surahId = String(val.surahId ?? "");
                    const ayahNum = Number(val.ayahNumber ?? 0);
                    const surahName = surahNames[surahId] ?? `سورة ${surahId}`;
                    return (
                      <div className="tafsir-item-header">
                        <div className="tafsir-item-meta">
                          <span className="tafsir-item-surah">{surahName}</span>
                          <span className="tafsir-item-ayah-num">آية {ayahNum}</span>
                        </div>
                        <p className={`tafsir-item-ayah-text${ayahText ? "" : " loading"}`}>
                          {ayahText ?? "جارٍ تحميل نص الآية..."}
                        </p>
                      </div>
                    );
                  })() : null}

                  <StructuredFieldEditor
                    key={`${currentModule?.id ?? moduleId}-${selectedItem.id}`}
                    label={selectedItem.label}
                    value={
                      currentModule?.id === "tafsir"
                        ? { tafsirParagraphs: (selectedItem.value as Record<string, unknown>).tafsirParagraphs }
                        : selectedItem.value
                    }
                    allowSchemaChanges={false}
                    showAdvancedFields={showAdvancedTools}
                    onChange={(next) => {
                      if (currentModule?.id === "tafsir") {
                        handleUpdateSelectedItem({
                          ...(selectedItem.value as Record<string, unknown>),
                          ...(next as Record<string, unknown>),
                        });
                      } else {
                        handleUpdateSelectedItem(next);
                      }
                    }}
                  />

                  {currentModule?.id === "tafsir" ? (
                    <div className="bulk-tafsir-panel">
                      <strong className="bulk-tafsir-label">تطبيق على نطاق من الآيات</strong>
                      <p className="field-helper">
                        طبّق نفس هذا التفسير على عدة آيات متتالية من نفس السورة.
                      </p>
                      <div className="bulk-tafsir-row">
                        <label className="bulk-tafsir-field">
                          <span>من الآية</span>
                          <input
                            className="field-input"
                            type="number"
                            min={1}
                            value={bulkFrom}
                            onChange={(e) => setBulkFrom(e.target.value)}
                          />
                        </label>
                        <label className="bulk-tafsir-field">
                          <span>إلى الآية</span>
                          <input
                            className="field-input"
                            type="number"
                            min={1}
                            value={bulkTo}
                            onChange={(e) => setBulkTo(e.target.value)}
                          />
                        </label>
                        <button
                          className="mini-button"
                          type="button"
                          onClick={handleBulkApplyTafsir}
                          disabled={!bulkFrom || !bulkTo || parseInt(bulkFrom) > parseInt(bulkTo)}
                        >
                          تطبيق
                        </button>
                      </div>
                      {(() => {
                        const from = parseInt(bulkFrom, 10);
                        const to = parseInt(bulkTo, 10);
                        if (isNaN(from) || isNaN(to) || from > to) return null;
                        const count = to - from + 1;
                        const nums = Array.from({ length: Math.min(count, 20) }, (_, i) => from + i);
                        return (
                          <div className="bulk-affected">
                            <span className="bulk-affected-label">
                              {count} {count === 1 ? "آية" : "آيات"} ستتأثر:
                            </span>
                            <div className="bulk-affected-chips">
                              {nums.map((n) => (
                                <span key={n} className="bulk-chip">آية {n}</span>
                              ))}
                              {count > 20 ? <span className="bulk-chip muted">...+{count - 20}</span> : null}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}

                  <div className="editor-actions secondary-save-row">
                    <button
                      className="button"
                      disabled={isPending || !dirty}
                      onClick={handleSave}
                    >
                      {isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                    </button>
                    <button
                      className="button-link danger-link"
                      type="button"
                      onClick={handleDeleteSelectedItem}
                    >
                      {`حذف ${itemLabel}`}
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-card field-card">
                  {`اختر ${itemLabel} من القائمة لبدء التعديل.`}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="panel padded">
          <div className="section-heading compact">
            <h2>تعديل المحتوى</h2>
            <p>يمكن تعديل الحقول مباشرة من هنا.</p>
          </div>
          <StructuredFieldEditor
            key={`root-${currentModule?.id ?? moduleId}`}
            label="المحتوى"
            value={documentValue}
            allowSchemaChanges={false}
            showAdvancedFields={showAdvancedTools}
            onChange={updateStructuredDocument}
          />

          <div className="editor-actions secondary-save-row">
            <button className="button" disabled={isPending || !dirty} onClick={handleSave}>
              {isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </button>
          </div>
        </div>
      )}

      <div className="advanced-toggle-row">
        <button
          className="button-link"
          type="button"
          onClick={() => setShowAdvancedTools((value) => !value)}
        >
          {showAdvancedTools ? "إخفاء الخيارات المتقدمة" : "أحتاج خيارات إضافية"}
        </button>
      </div>

      {confirmDialog ? (
        <div className="confirm-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-dialog-message">{confirmDialog.message}</p>
            <div className="confirm-dialog-actions">
              <button className="button-danger" type="button" onClick={confirmDialog.onConfirm}>
                تأكيد الحذف
              </button>
              <button className="button-soft" type="button" onClick={() => setConfirmDialog(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
