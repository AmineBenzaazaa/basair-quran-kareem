import {
  createEmptyContentDocuments,
  type ContentDocuments,
} from "../content/documents";
import { useContentVersion } from "../content/version-store";
import {
  type GlossaryEntry,
  type MethodSection,
  type Verse,
  parseGlossaryContent,
  parseMethodContent,
} from "./models";
import { normalizeArabic } from "../utils/arabic";

type DataState = {
  glossaryEntries: GlossaryEntry[];
  glossaryById: Record<string, GlossaryEntry>;
  verseList: Verse[];
  versesById: Record<string, Verse>;
  aliasToConceptId: Map<string, string>;
  methodSections: MethodSection[];
  getGlossaryEntry: (conceptId: string) => GlossaryEntry | null;
  getVerse: (verseId: string) => Verse | null;
  getDefaultVerse: () => Verse;
  findConceptIdByAlias: (alias: string) => string | null;
};

function getVerseRecord(documents: ContentDocuments): Record<string, Verse> {
  const raw = documents["verses-tokens"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const verses =
    "verses" in raw && raw.verses && typeof raw.verses === "object" && !Array.isArray(raw.verses)
      ? raw.verses
      : null;

  return (verses ?? {}) as Record<string, Verse>;
}

function buildDataState(documents: ContentDocuments): DataState {
  const glossaryData = parseGlossaryContent(documents.glossary);
  const methodData = parseMethodContent(documents["method-sections"]);

  const glossaryEntries = Object.values(glossaryData.entries).sort((a, b) =>
    a.title.localeCompare(b.title, "ar")
  );

  const glossaryById: Record<string, GlossaryEntry> = Object.fromEntries(
    glossaryEntries.map((entry) => [entry.id, entry])
  );
  const versesById = getVerseRecord(documents);
  let verseList: Verse[] | null = null;

  const getVerseList = () => {
    if (verseList) return verseList;

    verseList = Object.values(versesById).sort((a, b) =>
      a.id.localeCompare(b.id, "en")
    );

    return verseList;
  };

  const aliasToConceptId = new Map<string, string>();
  for (const entry of glossaryEntries) {
    const aliasBag = [entry.title, ...entry.aliases, ...(entry.keywords ?? [])];
    aliasBag.forEach((alias) => {
      const key = normalizeArabic(alias);
      if (key && !aliasToConceptId.has(key)) {
        aliasToConceptId.set(key, entry.id);
      }
    });
  }

  const methodSections = [...methodData.sections].sort((a, b) => a.order - b.order);

  const getGlossaryEntry = (conceptId: string) => glossaryById[conceptId] ?? null;

  const getVerse = (verseId: string) => versesById[verseId] ?? null;

  const getDefaultVerse = () => {
    const availableVerses = getVerseList();
    if (!availableVerses.length) {
      throw new Error("No verse data available");
    }
    return availableVerses[0];
  };

  const findConceptIdByAlias = (alias: string) => {
    const key = normalizeArabic(alias);
    return aliasToConceptId.get(key) ?? null;
  };

  return {
    glossaryEntries,
    glossaryById,
    get verseList() {
      return getVerseList();
    },
    versesById,
    aliasToConceptId,
    methodSections,
    getGlossaryEntry,
    getVerse,
    getDefaultVerse,
    findConceptIdByAlias,
  };
}

let dataState = buildDataState(createEmptyContentDocuments());

export function applyDataDocuments(documents: ContentDocuments) {
  dataState = buildDataState(documents);
}

export function getDataContent() {
  return dataState;
}

export function useDataContent() {
  useContentVersion();
  return dataState;
}

export const methodSections: MethodSection[] = dataState.methodSections;

export const methodologySections = methodSections;

export function getGlossaryEntry(conceptId: string): GlossaryEntry | null {
  return dataState.getGlossaryEntry(conceptId);
}

export function getVerse(verseId: string): Verse | null {
  return dataState.getVerse(verseId);
}

export function getDefaultVerse(): Verse {
  return dataState.getDefaultVerse();
}

export function findConceptIdByAlias(alias: string): string | null {
  return dataState.findConceptIdByAlias(alias);
}

export const contentIndex = {
  get glossaryEntries() {
    return dataState.glossaryEntries;
  },
  get glossaryById() {
    return dataState.glossaryById;
  },
  get verseList() {
    return dataState.verseList;
  },
  get versesById() {
    return dataState.versesById;
  },
  get aliasToConceptId() {
    return dataState.aliasToConceptId;
  },
};
