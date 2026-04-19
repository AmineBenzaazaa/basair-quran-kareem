/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import * as mammoth from "mammoth";

type GlossaryParagraph = {
  id: string;
  text: string;
};

type GlossaryVideo = {
  title: string;
  url: string;
};

type GlossaryEntry = {
  id: string;
  title: string;
  aliases: string[];
  root?: string;
  keywords?: string[];
  paragraphs: GlossaryParagraph[];
  defaultParagraphId: string;
  related?: string[];
  videos?: GlossaryVideo[];
  status: "ok" | "needs_review";
};

type GlossaryContent = {
  version: 1;
  entries: Record<string, GlossaryEntry>;
};

type RulesArticleSection = {
  heading: string;
  paragraphs: string[];
};

type RulesArticleDocument = {
  id: "rules";
  title: string;
  sections: RulesArticleSection[];
};

type MethodSection = {
  id: string;
  title: string;
  content: string[];
  order: number;
};

type MethodContent = {
  version: 1;
  sections: MethodSection[];
};

type IndexRow = {
  rowNumber: number;
  rawKeywordCellHtml: string;
  rawTitle: string;
  rawVideos: string;
};

type MatchResult = {
  paragraphIndex: number;
  alias: string;
  multiple: boolean;
};

const SCRIPT_DIR = __dirname;
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const RUNTIME_CONTENT_DIR = path.join(ROOT_DIR, "src", "data", "content");
const ARTICLE_CONTENT_DIR = path.join(ROOT_DIR, "assets", "content");

const DOC_NAMES = {
  index: ["فهرس المفردات.docx"],
  tafsir: [
    "تيسير القرآن بلسان العرب.docx",
    "تيسير القرآن بلسان العرب.docx",
  ],
  rules: ["القواعد الأساسية.docx", "القواعد الأساسية.docx"],
  method: [
    "الرسم البياني للمنهج القرآني.docx",
    "الرسم البياني للمنهج القرآني.docx",
  ],
} as const;

const DATA_DIR_CANDIDATES = [
  process.env.DATA_DIR,
  path.join(ROOT_DIR, "data"),
  "/mnt/data",
].filter(Boolean) as string[];

const DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const COMBINING_MARKS_RE = /\p{M}/gu;

const AR_TO_LATIN: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "aa",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "h",
  و: "w",
  ي: "y",
  ى: "a",
  ئ: "y",
  ؤ: "w",
  ء: "",
};

function normalizeForFilenameMatch(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS_RE, "")
    .replace(/\.docx$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s*edited(?:\s*\(\d+\))?\s*$/i, "")
    .replace(/\s*\(\d+\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isEditedFilename(input: string): boolean {
  return /\bedited\b/i.test(input);
}

function normalizeAuthorText(input: string): string {
  return input
    .replace(/\u00A0/g, " ")
    .replace(/\u200F|\u200E/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([،؛:,.!?])/g, "$1")
    .replace(/([،؛:!?])(?!\s|$)/g, "$1 ")
    .trim();
}

function normalizeForLookup(input: string): string {
  return input
    .replace(/\u00A0/g, " ")
    .replace(/\u200F|\u200E/g, "")
    .replace(DIACRITICS_RE, "")
    .replace(/[إأآٱا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function transliterateArabic(input: string): string {
  let out = "";
  for (const ch of input) {
    if (AR_TO_LATIN[ch]) {
      out += AR_TO_LATIN[ch];
      continue;
    }
    if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch.toLowerCase();
      continue;
    }
    if (/\s|-/.test(ch)) {
      out += "-";
      continue;
    }
  }
  return out;
}

function hashText(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function slugifyStable(input: string, fallbackSeed: string): string {
  const prepared = normalizeForLookup(input);
  const latin = transliterateArabic(prepared);
  const slug = latin
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  if (slug) return slug;
  return `id-${hashText(fallbackSeed).slice(0, 8)}`;
}

function toUniqueId(base: string, used: Set<string>): string {
  let value = base;
  let suffix = 2;
  while (used.has(value)) {
    value = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(value);
  return value;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);/g, (_, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    );
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]+>/g, " ");
}

function extractUrls(input: string): string[] {
  const urls = input.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(urls)];
}

function normalizeLines(rawText: string): string[] {
  return rawText
    .split("\n")
    .map((line) => normalizeAuthorText(line))
    .filter(Boolean);
}

function pushUniqueValue(target: string[], value: string) {
  if (!value) return;
  if (target.includes(value)) return;
  target.push(value);
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function sortArabic(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, "ar"));
}

function extractParagraphHtmlBlocks(cellHtml: string): string[] {
  const blocks = [...cellHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(
    (match) => match[1]
  );
  return blocks.length ? blocks : [cellHtml];
}

function normalizeHtmlTextPreserveSpaces(input: string): string {
  return decodeHtmlEntities(stripHtmlTags(input))
    .replace(/\u00A0/g, " ")
    .replace(/\u200F|\u200E/g, "")
    .replace(/\r?\n/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

function extractPlainAliasSegments(inputHtml: string): string[] {
  const raw = normalizeHtmlTextPreserveSpaces(inputHtml);
  if (!raw) return [];

  return raw
    .split(/\s{2,}|[|/،؛;,]+/g)
    .map((part) => normalizeAuthorText(part))
    .filter(Boolean);
}

async function loadFallbackGlossaryContent(): Promise<GlossaryContent | null> {
  const candidates = [
    path.join(RUNTIME_CONTENT_DIR, "glossary.json"),
    path.join(
      ROOT_DIR,
      "dashboard",
      "src",
      "lib",
      "content",
      "seeds",
      "glossary.json"
    ),
  ];

  for (const filePath of candidates) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<GlossaryContent>;
      const entries =
        parsed && typeof parsed === "object" && parsed.entries
          ? Object.keys(parsed.entries)
          : [];
      if (parsed?.version === 1 && entries.length > 0) {
        return parsed as GlossaryContent;
      }
    } catch {
      // Ignore missing or invalid fallback files and keep checking.
    }
  }

  return null;
}

async function extractParagraphsFromDocx(filePath: string): Promise<string[]> {
  const result = await mammoth.extractRawText({ path: filePath });
  return normalizeLines(result.value ?? "");
}

async function extractIndexRowsFromDocx(filePath: string): Promise<IndexRow[]> {
  const result = await mammoth.convertToHtml({ path: filePath });
  const html = result.value ?? "";
  const rowMatches = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];

  const rows = rowMatches.map((match) => {
    const cells = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(
      (cell) => cell[1]
    );
    return cells;
  });

  const bodyRows = rows.filter((cells, index) => {
    if (!cells.length) return false;
    if (index === 0 && cells.some((cell) => cell.includes("الكلمات"))) {
      return false;
    }
    return true;
  });

  return bodyRows.map((cells, index) => ({
    rowNumber: index + 2,
    rawKeywordCellHtml: cells[1] ?? "",
    rawTitle: normalizeAuthorText(normalizeHtmlTextPreserveSpaces(cells[2] ?? "")),
    // Keep URL punctuation untouched for reliable extraction.
    rawVideos: normalizeHtmlTextPreserveSpaces(cells[3] ?? ""),
  }));
}

function extractAliases(keywordCellHtml: string): string[] {
  if (!keywordCellHtml.trim()) return [];

  const aliases: string[] = [];

  for (const paragraphHtml of extractParagraphHtmlBlocks(keywordCellHtml)) {
    const strongMatches = [
      ...paragraphHtml.matchAll(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi),
    ];
    let cursor = 0;

    for (const match of strongMatches) {
      const start = match.index ?? 0;
      const before = paragraphHtml.slice(cursor, start);
      extractPlainAliasSegments(before).forEach((segment) =>
        pushUniqueValue(aliases, segment)
      );

      const strongText = normalizeAuthorText(
        normalizeHtmlTextPreserveSpaces(match[1] ?? "")
      );
      pushUniqueValue(aliases, strongText);
      cursor = start + match[0].length;
    }

    const after = paragraphHtml.slice(cursor);
    extractPlainAliasSegments(after).forEach((segment) =>
      pushUniqueValue(aliases, segment)
    );
  }

  return aliases.filter((alias) => normalizeForLookup(alias).length >= 3);
}

function findMatchInTafsir(
  aliases: string[],
  normalizedTafsirParagraphs: string[]
): MatchResult | null {
  const candidates = aliases
    .map((alias) => ({
      alias,
      normalized: normalizeForLookup(alias),
    }))
    .filter((item) => item.normalized.length >= 3)
    .sort((a, b) => b.normalized.length - a.normalized.length);

  for (const candidate of candidates) {
    const matches: number[] = [];
    normalizedTafsirParagraphs.forEach((paragraph, index) => {
      if (paragraph.includes(candidate.normalized)) {
        matches.push(index);
      }
    });

    if (!matches.length) continue;
    return {
      paragraphIndex: matches[0],
      alias: candidate.alias,
      multiple: matches.length > 1,
    };
  }

  return null;
}

function countPatternMatches(input: string, pattern: RegExp): number {
  return input.match(pattern)?.length ?? 0;
}

function isLikelyVerseParagraph(paragraph: string): boolean {
  const text = normalizeAuthorText(paragraph);
  if (!text) return false;

  const ayahMarkers = countPatternMatches(text, /\(\d{1,3}\)/g);
  const diacritics = countPatternMatches(text, DIACRITICS_RE);

  // Verse lines usually carry ayah markers and dense tashkeel.
  if (ayahMarkers >= 2) return true;
  if (ayahMarkers >= 1 && diacritics >= 8) return true;
  return false;
}

function selectPreferredParagraphIndex(
  tafsirParagraphs: string[],
  matchedIndex: number
): number {
  const matched = tafsirParagraphs[matchedIndex];
  if (!matched) return matchedIndex;
  if (!isLikelyVerseParagraph(matched)) return matchedIndex;

  const next = tafsirParagraphs[matchedIndex + 1];
  if (next && !isLikelyVerseParagraph(next)) {
    return matchedIndex + 1;
  }

  const previous = tafsirParagraphs[matchedIndex - 1];
  if (previous && !isLikelyVerseParagraph(previous)) {
    return matchedIndex - 1;
  }

  return matchedIndex;
}

function toYoutubeVideos(rawCell: string): GlossaryVideo[] | undefined {
  const urls = extractUrls(rawCell).filter((url) =>
    /(youtu\.be|youtube\.com)/i.test(url)
  );
  if (!urls.length) return undefined;
  const unique = [...new Set(urls)];
  return unique.map((url, index) => ({
    title: `فيديو ${index + 1}`,
    url,
  }));
}

const KEYWORD_STOPWORDS = new Set(
  [
    "ان",
    "إن",
    "الله",
    "الذي",
    "التي",
    "الذين",
    "إلى",
    "الي",
    "عن",
    "عند",
    "غير",
    "ذات",
    "ما",
    "من",
    "لم",
    "ولا",
    "ومن",
  ].map((item) => normalizeForLookup(item))
);

function shouldKeepKeywordToken(token: string): boolean {
  const normalized = normalizeForLookup(token);
  if (normalized.length < 3) return false;
  if (KEYWORD_STOPWORDS.has(normalized)) return false;
  return true;
}

function toKeywordsFromAliases(aliases: string[]): string[] | undefined {
  if (!aliases.length) return undefined;
  const terms = uniquePreserveOrder(
    aliases
      .flatMap((alias) => alias.split(" "))
      .map((token) => normalizeAuthorText(token))
      .filter((token) => shouldKeepKeywordToken(token))
  );
  if (!terms.length) return undefined;
  return terms.slice(0, 20);
}

function createGlossaryContent(
  rows: IndexRow[],
  tafsirParagraphs: string[]
): GlossaryContent {
  const normalizedTafsir = tafsirParagraphs.map((paragraph) =>
    normalizeForLookup(paragraph)
  );
  const usedIds = new Set<string>();
  const entries: GlossaryEntry[] = [];

  rows.forEach((row, index) => {
    const aliases = extractAliases(row.rawKeywordCellHtml);
    const fallbackTitle = aliases[0] || `مصطلح ${index + 1}`;
    const title = normalizeAuthorText(row.rawTitle) || fallbackTitle;
    const baseId = slugifyStable(title, `${row.rowNumber}:${title}`);
    const conceptId = toUniqueId(baseId, usedIds);
    const paragraphId = `${conceptId}:p1`;

    const match = findMatchInTafsir(aliases, normalizedTafsir);
    const selectedParagraphIndex = match
      ? selectPreferredParagraphIndex(tafsirParagraphs, match.paragraphIndex)
      : null;
    const matchedText =
      selectedParagraphIndex !== null ? tafsirParagraphs[selectedParagraphIndex] : null;
    const placeholderText = `لا يوجد شرح مطابق تلقائياً للمصطلح «${title}». يرجى مراجعته يدوياً.`;

    const paragraphs: GlossaryParagraph[] = [
      {
        id: paragraphId,
        text: normalizeAuthorText(matchedText ?? placeholderText),
      },
    ];

    entries.push({
      id: conceptId,
      title,
      aliases,
      keywords: toKeywordsFromAliases(aliases),
      paragraphs,
      defaultParagraphId: paragraphId,
      videos: toYoutubeVideos(row.rawVideos),
      status: match && !match.multiple ? "ok" : "needs_review",
    });
  });

  const ordered = entries.sort((a, b) => a.id.localeCompare(b.id, "en"));
  const entriesRecord: Record<string, GlossaryEntry> = {};
  ordered.forEach((entry) => {
    entriesRecord[entry.id] = entry;
  });

  return {
    version: 1,
    entries: entriesRecord,
  };
}

function isRulesMajorHeading(line: string): boolean {
  if (!line) return false;
  const compact = normalizeAuthorText(line);
  if (compact === "مقدمة") return true;
  if (/^القاعدة\s+/.test(compact)) return true;
  if (/^الضابط\s+/.test(compact)) return true;
  if (/^خلاصة\s+المنهجية/.test(compact)) return true;
  if (/^ملخص\s+منهجي/.test(compact)) return true;
  return false;
}

const RULE_ORDINAL_TO_NUMBER = {
  الأولى: 1,
  الأول: 1,
  الثانية: 2,
  الثاني: 2,
  الثالثة: 3,
  الثالث: 3,
  الرابعة: 4,
  الرابع: 4,
  الخامسة: 5,
  الخامس: 5,
  السادسة: 6,
  السادس: 6,
  السابعة: 7,
  السابع: 7,
} as const;

const RULE_NUMBER_TO_DISPLAY_WORD = {
  1: "الأولى",
  2: "الثانية",
  3: "الثالثة",
  4: "الرابعة",
  5: "الخامسة",
  6: "السادسة",
  7: "السابعة",
} as const;

function normalizeRulesSectionHeading(input: string): string {
  const compact = normalizeAuthorText(input);
  const match = compact.match(
    /^(?:القاعدة|الضابط)\s+(الأولى|الأول|الثانية|الثاني|الثالثة|الثالث|الرابعة|الرابع|الخامسة|الخامس|السادسة|السادس|السابعة|السابع)\s*:\s*(.+)$/
  );

  if (!match) {
    return compact;
  }

  const ruleNumber =
    RULE_ORDINAL_TO_NUMBER[match[1] as keyof typeof RULE_ORDINAL_TO_NUMBER];
  const shortTitle = match[2].trim() || compact;

  return `القاعدة ${RULE_NUMBER_TO_DISPLAY_WORD[ruleNumber]}: ${shortTitle}`;
}

function createRulesArticleDocument(lines: string[]): RulesArticleDocument {
  const sanitized = lines
    .map((line) => normalizeAuthorText(line))
    .filter(Boolean)
    .filter((line, index) => {
      if (index !== 0) return true;
      return !line.includes("القواعد") || !line.includes("الإلهية");
    });

  const chunks: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of sanitized) {
    if (isRulesMajorHeading(line)) {
      if (current) chunks.push(current);
      current = {
        title: line,
        lines: [],
      };
      continue;
    }
    if (!current) {
      current = {
        title: "مقدمة",
        lines: [line],
      };
      continue;
    }
    current.lines.push(line);
  }
  if (current) chunks.push(current);

  const sections = chunks
    .map((chunk) => ({
      heading: normalizeRulesSectionHeading(chunk.title),
      paragraphs: uniquePreserveOrder(chunk.lines),
    }))
    .filter((section) => section.heading && section.paragraphs.length > 0);

  return {
    id: "rules",
    title: "القواعد الأساسية",
    sections,
  };
}

function compactSectionContent(lines: string[], maxLines: number): string[] {
  const cleaned = uniquePreserveOrder(
    lines
      .map((line) => normalizeAuthorText(line))
      .filter(Boolean)
      .filter((line) => line !== ":" && line !== "المصدر القرآني")
  );
  return cleaned.slice(0, maxLines);
}

function createMethodContent(lines: string[]): MethodContent {
  const sanitized = lines
    .map((line) => normalizeAuthorText(line))
    .filter(Boolean)
    .filter((line, index) => {
      if (index !== 0) return true;
      return !line.includes("الرسم البياني");
    });

  const idxTafsir = sanitized.findIndex((line) => /^التفسير$/.test(line));
  const idxTawil = sanitized.findIndex(
    (line, index) =>
      index > idxTafsir &&
      (/^2\s*-\s*التأويل$/.test(line) || /^التأويل$/.test(line))
  );

  const overviewRaw =
    idxTafsir > 0 ? sanitized.slice(0, idxTafsir) : sanitized.slice(0, 3);
  const tafsirRaw =
    idxTafsir >= 0
      ? sanitized.slice(idxTafsir + 1, idxTawil > idxTafsir ? idxTawil : undefined)
      : [];
  const tawilRaw = idxTawil >= 0 ? sanitized.slice(idxTawil + 1) : [];

  const overview = compactSectionContent(overviewRaw, 8);
  const tafsir = compactSectionContent(tafsirRaw, 12);
  const tawil = compactSectionContent(tawilRaw, 12);

  const sections: MethodSection[] = [
    {
      id: "method:overview",
      title: "المنهج القرآني",
      content:
        overview.length > 0
          ? overview
          : ["يمر التدبر بمرحلتين: التفسير ثم التأويل."],
      order: 1,
    },
    {
      id: "method:tafsir",
      title: "التفسير",
      content:
        tafsir.length > 0
          ? tafsir
          : ["الاعتماد على المعجم أو الآيات القرآنية لفهم الدلالة."],
      order: 2,
    },
    {
      id: "method:tawil",
      title: "التأويل",
      content:
        tawil.length > 0
          ? tawil
          : ["استنباط ما يؤول إليه القول أو الفعل ضمن اللسان العربي."],
      order: 3,
    },
  ];

  return {
    version: 1,
    sections,
  };
}

async function resolveDocPath(
  dataDir: string,
  candidates: readonly string[]
): Promise<string | null> {
  const files = await fs.readdir(dataDir);
  const normalized = files.map((file) => ({
    file,
    normalized: normalizeForFilenameMatch(file),
    edited: isEditedFilename(file),
  }));

  for (const candidate of candidates) {
    const target = normalizeForFilenameMatch(candidate);
    const matches = normalized
      .filter((item) => item.normalized === target)
      .sort(
        (a, b) =>
          Number(b.edited) - Number(a.edited) ||
          a.file.localeCompare(b.file, "en")
      );
    if (matches[0]) return path.join(dataDir, matches[0].file);
  }

  return null;
}

async function resolveDataDirAndDocs() {
  for (const dir of DATA_DIR_CANDIDATES) {
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const resolved = {
      index: await resolveDocPath(dir, DOC_NAMES.index),
      tafsir: await resolveDocPath(dir, DOC_NAMES.tafsir),
      rules: await resolveDocPath(dir, DOC_NAMES.rules),
      method: await resolveDocPath(dir, DOC_NAMES.method),
    };

    const requiredFound = Boolean(resolved.index && resolved.rules && resolved.method);
    if (!requiredFound) continue;

    return {
      dataDir: dir,
      docs: resolved,
    };
  }

  throw new Error(
    `لم يتم العثور على ملفات DOCX المطلوبة. تحقق من المسارات: ${DATA_DIR_CANDIDATES.join(
      ", "
    )}`
  );
}

async function writeJsonFile(filePath: string, payload: unknown) {
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(filePath, content, "utf8");
}

async function run() {
  const { dataDir, docs } = await resolveDataDirAndDocs();
  await Promise.all([
    fs.mkdir(RUNTIME_CONTENT_DIR, { recursive: true }),
    fs.mkdir(ARTICLE_CONTENT_DIR, { recursive: true }),
  ]);

  const [indexRows, rulesLines, methodLines, tafsirLines] = await Promise.all([
    extractIndexRowsFromDocx(docs.index as string),
    extractParagraphsFromDocx(docs.rules as string),
    extractParagraphsFromDocx(docs.method as string),
    docs.tafsir ? extractParagraphsFromDocx(docs.tafsir) : Promise.resolve([]),
  ]);

  let glossary = createGlossaryContent(indexRows, tafsirLines);
  if (!Object.keys(glossary.entries).length) {
    const fallbackGlossary = await loadFallbackGlossaryContent();
    if (fallbackGlossary) {
      glossary = fallbackGlossary;
      console.warn(
        "تعذر استخراج فهرس المفردات من ملف Word الحالي؛ تم الإبقاء على glossary.json غير الفارغ."
      );
    } else {
      throw new Error(
        "تعذر استخراج glossary.json من ملف فهرس المفردات الحالي، ولا يوجد ملف احتياطي صالح."
      );
    }
  }

  const rules = createRulesArticleDocument(rulesLines);
  const method = createMethodContent(methodLines);

  await Promise.all([
    writeJsonFile(path.join(RUNTIME_CONTENT_DIR, "glossary.json"), glossary),
    writeJsonFile(path.join(ARTICLE_CONTENT_DIR, "rules.json"), rules),
    writeJsonFile(path.join(RUNTIME_CONTENT_DIR, "method.json"), method),
  ]);

  console.log("تم توليد محتوى runtime بنجاح:");
  console.log(`- data dir: ${dataDir}`);
  console.log(`- glossary entries: ${Object.keys(glossary.entries).length}`);
  console.log(`- rules sections: ${rules.sections.length}`);
  console.log(`- method sections: ${method.sections.length}`);
  console.log(`- runtime output: ${RUNTIME_CONTENT_DIR}`);
  console.log(`- article output: ${ARTICLE_CONTENT_DIR}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
