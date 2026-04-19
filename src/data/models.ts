export type GlossaryStatus = "ok" | "needs_review" | "missing_source";

export type GlossaryParagraph = {
  id: string;
  text: string;
};

export type GlossaryVideo = {
  title: string;
  url: string;
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
};

export type GlossaryContent = {
  version: 1;
  entries: Record<string, GlossaryEntry>;
};

export type MethodSection = {
  id: string;
  title: string;
  content: string[];
  order: number;
};

export type MethodContent = {
  version: 1;
  sections: MethodSection[];
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

function parseGlossaryParagraphs(value: unknown, path: string): GlossaryParagraph[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected paragraphs[] at ${path}`);
  }
  return value.map((item, index) => {
    // Some entries stored via the dashboard save paragraphs as plain strings
    // rather than {id, text} objects — accept both shapes.
    if (typeof item === "string") {
      return { id: `p${index}`, text: item };
    }
    if (!isObject(item)) {
      throw new Error(`Expected paragraph object at ${path}[${index}]`);
    }
    return {
      id: expectString(item.id, `${path}[${index}].id`),
      text: expectString(item.text, `${path}[${index}].text`),
    };
  });
}

function parseVideos(value: unknown, path: string): GlossaryVideo[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`Expected videos[] at ${path}`);
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

  if (status === "ok" || status === "needs_review" || status === "missing_source") {
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
    paragraphs: parseGlossaryParagraphs(value.paragraphs, `${path}.paragraphs`),
    defaultParagraphId:
      typeof value.defaultParagraphId === "string"
        ? value.defaultParagraphId
        : "p0",
    related:
      value.related === undefined
        ? undefined
        : expectStringArray(value.related, `${path}.related`),
    videos: parseVideos(value.videos, `${path}.videos`),
    status,
  };
}

export function parseGlossaryContent(value: unknown): GlossaryContent {
  if (!isObject(value)) {
    throw new Error("glossary.json must be an object");
  }
  if (value.version !== 1) {
    throw new Error("glossary.json.version must be 1");
  }
  if (!isObject(value.entries)) {
    throw new Error("glossary.json.entries must be an object");
  }

  const entries: Record<string, GlossaryEntry> = {};
  Object.entries(value.entries).forEach(([conceptId, entry]) => {
    entries[conceptId] = parseGlossaryEntry(entry, `entries.${conceptId}`);
  });

  return {
    version: 1,
    entries,
  };
}

function parseMethodSection(value: unknown, path: string): MethodSection {
  if (!isObject(value)) {
    throw new Error(`Expected method section object at ${path}`);
  }
  return {
    id: expectString(value.id, `${path}.id`),
    title: expectString(value.title, `${path}.title`),
    content: expectStringArray(value.content, `${path}.content`),
    order: expectNumber(value.order, `${path}.order`),
  };
}

export function parseMethodContent(value: unknown): MethodContent {
  if (!isObject(value)) {
    throw new Error("method.json must be an object");
  }
  if (value.version !== 1) {
    throw new Error("method.json.version must be 1");
  }
  if (!Array.isArray(value.sections)) {
    throw new Error("method.json.sections must be an array");
  }

  return {
    version: 1,
    sections: value.sections.map((item, index) =>
      parseMethodSection(item, `sections[${index}]`)
    ),
  };
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
