import type { DashboardModuleId } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getArrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function getNestedArrayCount(value: unknown, key: string): number {
  return isRecord(value) && Array.isArray(value[key]) ? value[key].length : 0;
}

function getNestedObjectCount(value: unknown, key: string): number {
  return isRecord(value) && isRecord(value[key])
    ? Object.keys(value[key]).length
    : 0;
}

export function summarizeDocument(
  moduleId: DashboardModuleId,
  document: unknown
): string {
  switch (moduleId) {
    case "intro":
    case "concepts":
    case "rules-article":
    case "method-flow":
      return `${getNestedArrayCount(document, "sections")} قسم`;
    case "method-sections":
      return `${getNestedArrayCount(document, "sections")} قسم`;
    case "glossary":
      return `${getNestedObjectCount(document, "entries")} مفردة`;
    case "surahs":
      return `${getArrayCount(document)} سورة`;
    case "ayahs":
      return `${getArrayCount(document)} آية`;
    case "tafsir":
      return `${getArrayCount(document)} تفسير`;
    default:
      if (Array.isArray(document)) {
        return `${document.length} عنصر`;
      }
      if (isRecord(document)) {
        return `${Object.keys(document).length} حقل`;
      }
      return "قيمة مفردة";
  }
}
