export const CONTENT_MODULE_IDS = [
  "intro",
  "concepts",
  "rules-article",
  "method-flow",
  "method-sections",
  "glossary",
  "surahs",
  "ayahs",
  "tafsir",
  "verses-tokens",
] as const;

export type ContentModuleId = (typeof CONTENT_MODULE_IDS)[number];

export type ContentDocuments = {
  intro: unknown;
  concepts: unknown;
  "rules-article": unknown;
  "method-flow": unknown;
  "method-sections": unknown;
  glossary: unknown;
  surahs: unknown;
  ayahs: unknown;
  tafsir: unknown;
  "verses-tokens": unknown;
};

export function cloneContentDocuments(
  documents: ContentDocuments
): ContentDocuments {
  return JSON.parse(JSON.stringify(documents)) as ContentDocuments;
}

export function createEmptyContentDocuments(): ContentDocuments {
  return {
    intro: {
      id: "intro",
      title: "",
      sections: [],
    },
    concepts: {
      sections: [],
    },
    "rules-article": {
      sections: [],
    },
    "method-flow": {
      sections: [],
    },
    "method-sections": {
      version: 1,
      sections: [],
    },
    glossary: {
      version: 1,
      entries: {},
    },
    surahs: [],
    ayahs: [],
    tafsir: [],
    "verses-tokens": {
      version: 1,
      verses: {},
    },
  };
}

export function assertCompleteContentDocuments(
  documents: Partial<Record<ContentModuleId, unknown>>
): ContentDocuments {
  const missingModules = CONTENT_MODULE_IDS.filter(
    (moduleId) => !Object.prototype.hasOwnProperty.call(documents, moduleId)
  );

  if (missingModules.length) {
    throw new Error(
      `Supabase content_modules is missing: ${missingModules.join(
        ", "
      )}. Run "npm run supabase:content:push" to seed every module.`
    );
  }

  // No deep-clone: the caller owns this object (bundled imports are read-only,
  // Supabase/AsyncStorage data is freshly parsed). Cloning 15 MB on every load
  // added 1–3 s of pure CPU cost with no benefit.
  return documents as ContentDocuments;
}
