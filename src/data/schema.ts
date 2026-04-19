export type GlossaryStatus = "ok" | "missing_source" | "needs_review";

export type GlossaryParagraph = {
  id: string;
  text: string;
  source?: string;
};

export type GlossaryVideo = {
  title: string;
  url: string;
};

export type SourceRef = {
  file: string;
  hint?: string;
};

export type GlossaryEntry = {
  id: string;
  title: string;
  aliases: string[];
  root?: string;
  keywords?: string[];
  paragraphs: GlossaryParagraph[];
  defaultParagraphId: string;
  related?: string[];
  videos?: GlossaryVideo[];
  status: GlossaryStatus;
  sourceRefs: SourceRef[];
};

export type GlossaryData = {
  entries: Record<string, GlossaryEntry>;
};

export type VerseToken = {
  t: string;
  conceptId?: string;
  paragraphId?: string;
  style?: "red";
};

export type Verse = {
  id: string;
  surah: number;
  ayah: number;
  text: string;
  tokens: VerseToken[];
  notes?: string;
};

export type VersesData = {
  verses: Record<string, Verse>;
};

export type MethodologySection = {
  id: string;
  title: string;
  content: string[];
  source: string;
};

export type MethodologyData = {
  sections: MethodologySection[];
};

const LEGACY_GLOSSARY_STATUS_MAP: Record<string, GlossaryStatus> = {
  draft: "needs_review",
  published: "ok",
  missingSource: "missing_source",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${path}`);
  }
  return value;
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Expected number at ${path}`);
  }
  return value;
}

function expectStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected string[] at ${path}`);
  }
  return value.map((item, index) => expectString(item, `${path}[${index}]`));
}

function parseSourceRefs(value: unknown, path: string): SourceRef[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected SourceRef[] at ${path}`);
  }
  return value.map((item, index) => {
    if (!isObject(item)) {
      throw new Error(`Expected SourceRef object at ${path}[${index}]`);
    }
    return {
      file: expectString(item.file, `${path}[${index}].file`),
      hint:
        item.hint === undefined
          ? undefined
          : expectString(item.hint, `${path}[${index}].hint`),
    };
  });
}

function parseParagraphs(value: unknown, path: string): GlossaryParagraph[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected paragraph[] at ${path}`);
  }
  return value.map((item, index) => {
    if (!isObject(item)) {
      throw new Error(`Expected paragraph object at ${path}[${index}]`);
    }
    return {
      id: expectString(item.id, `${path}[${index}].id`),
      text: expectString(item.text, `${path}[${index}].text`),
      source:
        item.source === undefined
          ? undefined
          : expectString(item.source, `${path}[${index}].source`),
    };
  });
}

function parseVideos(value: unknown, path: string): GlossaryVideo[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`Expected video[] at ${path}`);
  }
  return value.map((item, index) => {
    if (!isObject(item)) {
      throw new Error(`Expected video object at ${path}[${index}]`);
    }
    return {
      title: expectString(item.title, `${path}[${index}].title`),
      url: expectString(item.url, `${path}[${index}].url`),
    };
  });
}

function parseGlossaryStatus(value: unknown, path: string): GlossaryStatus {
  const status = expectString(value, `${path}.status`).trim();

  if (status === "ok" || status === "missing_source" || status === "needs_review") {
    return status;
  }

  const normalized = LEGACY_GLOSSARY_STATUS_MAP[status];
  if (normalized) {
    console.warn(
      `[content] Normalized legacy glossary status at ${path}.status from "${status}" to "${normalized}".`
    );
    return normalized;
  }

  console.warn(
    `[content] Unknown glossary status at ${path}.status: "${status}". Falling back to "needs_review".`
  );
  return "needs_review";
}

function parseGlossaryEntry(value: unknown, path: string): GlossaryEntry {
  if (!isObject(value)) {
    throw new Error(`Expected glossary entry object at ${path}`);
  }

  const status = parseGlossaryStatus(value.status, path);

  return {
    id: expectString(value.id, `${path}.id`),
    title: expectString(value.title, `${path}.title`),
    aliases: expectStringArray(value.aliases, `${path}.aliases`),
    root:
      value.root === undefined
        ? undefined
        : expectString(value.root, `${path}.root`),
    keywords:
      value.keywords === undefined
        ? undefined
        : expectStringArray(value.keywords, `${path}.keywords`),
    paragraphs: parseParagraphs(value.paragraphs, `${path}.paragraphs`),
    defaultParagraphId: expectString(
      value.defaultParagraphId,
      `${path}.defaultParagraphId`
    ),
    related:
      value.related === undefined
        ? undefined
        : expectStringArray(value.related, `${path}.related`),
    videos: parseVideos(value.videos, `${path}.videos`),
    status,
    sourceRefs: parseSourceRefs(value.sourceRefs, `${path}.sourceRefs`),
  };
}

export function parseGlossaryData(value: unknown): GlossaryData {
  if (!isObject(value)) {
    throw new Error("glossary.json must be an object");
  }
  if (!isObject(value.entries)) {
    throw new Error("glossary.json.entries must be an object");
  }

  const entries: Record<string, GlossaryEntry> = {};
  Object.entries(value.entries).forEach(([conceptId, entry]) => {
    entries[conceptId] = parseGlossaryEntry(entry, `entries.${conceptId}`);
  });
  return { entries };
}

function parseVerseToken(value: unknown, path: string): VerseToken {
  if (!isObject(value)) {
    throw new Error(`Expected verse token object at ${path}`);
  }

  const styleValue = value.style;
  if (styleValue !== undefined && styleValue !== "red") {
    throw new Error(`Invalid token style at ${path}.style`);
  }

  return {
    t: expectString(value.t, `${path}.t`),
    conceptId:
      value.conceptId === undefined
        ? undefined
        : expectString(value.conceptId, `${path}.conceptId`),
    paragraphId:
      value.paragraphId === undefined
        ? undefined
        : expectString(value.paragraphId, `${path}.paragraphId`),
    style: styleValue,
  };
}

function parseVerse(value: unknown, path: string): Verse {
  if (!isObject(value)) {
    throw new Error(`Expected verse object at ${path}`);
  }
  if (!Array.isArray(value.tokens)) {
    throw new Error(`Expected tokens[] at ${path}.tokens`);
  }
  return {
    id: expectString(value.id, `${path}.id`),
    surah: expectNumber(value.surah, `${path}.surah`),
    ayah: expectNumber(value.ayah, `${path}.ayah`),
    text: expectString(value.text, `${path}.text`),
    tokens: value.tokens.map((token, index) =>
      parseVerseToken(token, `${path}.tokens[${index}]`)
    ),
    notes:
      value.notes === undefined
        ? undefined
        : expectString(value.notes, `${path}.notes`),
  };
}

export function parseVersesData(value: unknown): VersesData {
  if (!isObject(value)) {
    throw new Error("verses.json must be an object");
  }
  if (!isObject(value.verses)) {
    throw new Error("verses.json.verses must be an object");
  }

  const verses: Record<string, Verse> = {};
  Object.entries(value.verses).forEach(([verseId, verse]) => {
    verses[verseId] = parseVerse(verse, `verses.${verseId}`);
  });
  return { verses };
}

export function parseMethodologyData(value: unknown): MethodologyData {
  if (!isObject(value)) {
    throw new Error("methodology.json must be an object");
  }
  if (!Array.isArray(value.sections)) {
    throw new Error("methodology.json.sections must be an array");
  }

  const sections = value.sections.map((section, index) => {
    if (!isObject(section)) {
      throw new Error(`Expected section object at sections[${index}]`);
    }
    return {
      id: expectString(section.id, `sections[${index}].id`),
      title: expectString(section.title, `sections[${index}].title`),
      content: expectStringArray(section.content, `sections[${index}].content`),
      source: expectString(section.source, `sections[${index}].source`),
    };
  });

  return { sections };
}
