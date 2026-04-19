"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const mammoth = __importStar(require("mammoth"));
const SCRIPT_DIR = __dirname;
const ROOT_DIR = node_path_1.default.resolve(SCRIPT_DIR, "..");
const OUTPUT_DIR = node_path_1.default.join(ROOT_DIR, "src", "data", "generated");
const DOC_NAMES = {
    tafsir: [
        "تيسير القرآن بلسان العرب.docx",
        "تيسير القرآن بلسان العرب.docx",
    ],
    index: ["فهرس المفردات.docx"],
    rules: ["القواعد الأساسية.docx", "القواعد الأساسية.docx"],
    method: [
        "الرسم البياني للمنهج القرآني.docx",
        "الرسم البياني للمنهج القرآني.docx",
    ],
    concepts: ["المعاني والدلالات.docx"],
    intro: ["تعريف تطبيق.docx"],
};
const DATA_DIR_CANDIDATES = [
    process.env.DATA_DIR,
    node_path_1.default.join(ROOT_DIR, "data"),
    "/mnt/data",
].filter(Boolean);
const DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const COMBINING_MARKS_RE = /\p{M}/gu;
const AR_TO_LATIN = {
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
function normalizeForFilenameMatch(input) {
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
function isEditedFilename(input) {
    return /\bedited\b/i.test(input);
}
function normalizeAuthorText(input) {
    return input
        .replace(/\u00A0/g, " ")
        .replace(/\u200F|\u200E/g, "")
        .replace(/\s+/g, " ")
        .replace(/\s+([،؛:,.!?])/g, "$1")
        .replace(/([،؛:!?])(?!\s|$)/g, "$1 ")
        .trim();
}
function normalizeForLookup(input) {
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
function transliterateArabic(input) {
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
function slugifyStable(input, fallback) {
    const prepared = normalizeForLookup(input);
    const latin = transliterateArabic(prepared);
    const slug = latin
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 64);
    return slug || fallback;
}
function hashText(input) {
    let hash = 5381;
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash * 33) ^ input.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
}
function toUniqueId(base, used) {
    let value = base;
    let suffix = 2;
    while (used.has(value)) {
        value = `${base}-${suffix}`;
        suffix += 1;
    }
    used.add(value);
    return value;
}
function decodeHtmlEntities(input) {
    return input
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)));
}
function stripHtmlTags(input) {
    return input.replace(/<[^>]+>/g, " ");
}
function extractUrls(input) {
    const urls = input.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
    return [...new Set(urls)];
}
function normalizeLines(rawText) {
    return rawText
        .split("\n")
        .map((line) => normalizeAuthorText(line))
        .filter(Boolean);
}
function pushUniqueValue(target, value) {
    if (!value)
        return;
    if (target.includes(value))
        return;
    target.push(value);
}
function extractParagraphHtmlBlocks(cellHtml) {
    const blocks = [...cellHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => match[1]);
    return blocks.length ? blocks : [cellHtml];
}
function normalizeHtmlTextPreserveSpaces(input) {
    return decodeHtmlEntities(stripHtmlTags(input))
        .replace(/\u00A0/g, " ")
        .replace(/\u200F|\u200E/g, "")
        .replace(/\r?\n/g, " ")
        .replace(/\t/g, " ")
        .trim();
}
function extractPlainAliasSegments(inputHtml) {
    const raw = normalizeHtmlTextPreserveSpaces(inputHtml);
    if (!raw)
        return [];
    return raw
        .split(/\s{2,}|[|/،؛;,]+/g)
        .map((part) => normalizeAuthorText(part))
        .filter(Boolean);
}
async function loadFallbackGlossaryData() {
    const candidates = [
        node_path_1.default.join(ROOT_DIR, "src", "data", "content", "glossary.json"),
        node_path_1.default.join(ROOT_DIR, "dashboard", "src", "lib", "content", "seeds", "glossary.json"),
    ];
    for (const filePath of candidates) {
        try {
            const raw = await promises_1.default.readFile(filePath, "utf8");
            const parsed = JSON.parse(raw);
            const entries = parsed && typeof parsed === "object" && parsed.entries
                ? Object.values(parsed.entries)
                : [];
            if (parsed?.version !== 1 || !entries.length) {
                continue;
            }
            return {
                entries: Object.fromEntries(entries.map((entry) => [
                    entry.id,
                    {
                        id: entry.id,
                        title: entry.title,
                        aliases: entry.aliases,
                        root: entry.root,
                        keywords: entry.keywords,
                        paragraphs: entry.paragraphs.map((paragraph) => ({
                            id: paragraph.id,
                            text: paragraph.text,
                        })),
                        defaultParagraphId: entry.defaultParagraphId,
                        related: entry.related,
                        videos: entry.videos,
                        status: entry.status,
                        sourceRefs: [],
                    },
                ])),
            };
        }
        catch {
            // Ignore missing or invalid fallback files and keep checking.
        }
    }
    return null;
}
async function extractParagraphsFromDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return normalizeLines(result.value ?? "");
}
async function extractIndexRowsFromDocx(filePath) {
    const result = await mammoth.convertToHtml({ path: filePath });
    const html = result.value ?? "";
    const rowMatches = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    const rows = rowMatches.map((match) => {
        const cells = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) => cell[1]);
        return cells;
    });
    const bodyRows = rows.filter((cells, index) => {
        if (!cells.length)
            return false;
        if (index === 0 && cells.some((cell) => cell.includes("الكلمات"))) {
            return false;
        }
        return true;
    });
    return bodyRows.map((cells, index) => ({
        rowNumber: index + 2,
        rawKeywordCellHtml: cells[1] ?? "",
        rawTitleCell: normalizeAuthorText(normalizeHtmlTextPreserveSpaces(cells[2] ?? "")),
        rawVideosCell: normalizeHtmlTextPreserveSpaces(cells[3] ?? ""),
    }));
}
function extractAliases(keywordCellHtml) {
    if (!keywordCellHtml.trim())
        return [];
    const aliases = [];
    for (const paragraphHtml of extractParagraphHtmlBlocks(keywordCellHtml)) {
        const strongMatches = [
            ...paragraphHtml.matchAll(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi),
        ];
        let cursor = 0;
        for (const match of strongMatches) {
            const start = match.index ?? 0;
            const before = paragraphHtml.slice(cursor, start);
            extractPlainAliasSegments(before).forEach((segment) => pushUniqueValue(aliases, segment));
            const strongText = normalizeAuthorText(normalizeHtmlTextPreserveSpaces(match[1] ?? ""));
            pushUniqueValue(aliases, strongText);
            cursor = start + match[0].length;
        }
        const after = paragraphHtml.slice(cursor);
        extractPlainAliasSegments(after).forEach((segment) => pushUniqueValue(aliases, segment));
    }
    return aliases.filter((alias) => normalizeForLookup(alias).length >= 3);
}
function getParagraphId(conceptId, text, index) {
    const preview = text.split(" ").slice(0, 6).join(" ");
    const base = slugifyStable(preview, `p${index}`);
    const hash = hashText(text).slice(0, 6);
    return `${conceptId}__${base}-${hash}`;
}
function findMatchInTafsir(aliases, normalizedTafsirParagraphs) {
    // Prefer the longest alias first to reduce false positives.
    const candidates = aliases
        .map((alias) => ({
        alias,
        normalized: normalizeForLookup(alias),
    }))
        .filter((item) => item.normalized.length >= 3)
        .sort((a, b) => b.normalized.length - a.normalized.length);
    for (const candidate of candidates) {
        const matches = [];
        normalizedTafsirParagraphs.forEach((paragraph, index) => {
            if (paragraph.includes(candidate.normalized)) {
                matches.push(index);
            }
        });
        if (!matches.length)
            continue;
        return {
            paragraphIndex: matches[0],
            alias: candidate.alias,
            multiple: matches.length > 1,
        };
    }
    return null;
}
function countPatternMatches(input, pattern) {
    return input.match(pattern)?.length ?? 0;
}
function isLikelyVerseParagraph(paragraph) {
    const text = normalizeAuthorText(paragraph);
    if (!text)
        return false;
    const ayahMarkers = countPatternMatches(text, /\(\d{1,3}\)/g);
    const diacritics = countPatternMatches(text, DIACRITICS_RE);
    if (ayahMarkers >= 2)
        return true;
    if (ayahMarkers >= 1 && diacritics >= 8)
        return true;
    return false;
}
function selectPreferredParagraphIndex(tafsirParagraphs, matchedIndex) {
    const matched = tafsirParagraphs[matchedIndex];
    if (!matched)
        return matchedIndex;
    if (!isLikelyVerseParagraph(matched))
        return matchedIndex;
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
const KEYWORD_STOPWORDS = new Set([
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
].map((item) => normalizeForLookup(item)));
function shouldKeepKeywordToken(token) {
    const normalized = normalizeForLookup(token);
    if (normalized.length < 3)
        return false;
    if (KEYWORD_STOPWORDS.has(normalized))
        return false;
    return true;
}
function toKeywordsFromAliases(aliases) {
    if (!aliases.length)
        return undefined;
    const terms = aliases
        .flatMap((alias) => alias.split(" "))
        .map((token) => normalizeAuthorText(token))
        .filter((token) => shouldKeepKeywordToken(token));
    const unique = [...new Set(terms)];
    return unique.length ? unique.slice(0, 20) : undefined;
}
function entrySort(a, b) {
    return a.id.localeCompare(b.id, "en");
}
async function resolveDocPath(dataDir, candidates) {
    const files = await promises_1.default.readdir(dataDir);
    const normalized = files.map((file) => ({
        file,
        normalized: normalizeForFilenameMatch(file),
        edited: isEditedFilename(file),
    }));
    for (const candidate of candidates) {
        const target = normalizeForFilenameMatch(candidate);
        const matches = normalized
            .filter((item) => item.normalized === target)
            .sort((a, b) => Number(b.edited) - Number(a.edited) ||
            a.file.localeCompare(b.file, "en"));
        if (matches[0])
            return node_path_1.default.join(dataDir, matches[0].file);
    }
    return null;
}
async function resolveDataDirAndDocs() {
    for (const dir of DATA_DIR_CANDIDATES) {
        try {
            const stat = await promises_1.default.stat(dir);
            if (!stat.isDirectory())
                continue;
        }
        catch {
            continue;
        }
        const resolved = {
            tafsir: await resolveDocPath(dir, DOC_NAMES.tafsir),
            index: await resolveDocPath(dir, DOC_NAMES.index),
            rules: await resolveDocPath(dir, DOC_NAMES.rules),
            method: await resolveDocPath(dir, DOC_NAMES.method),
            concepts: await resolveDocPath(dir, DOC_NAMES.concepts),
            intro: await resolveDocPath(dir, DOC_NAMES.intro),
        };
        const allFound = Object.values(resolved).every(Boolean);
        if (allFound) {
            return {
                dataDir: dir,
                docs: resolved,
            };
        }
    }
    throw new Error(`لم يتم العثور على ملفات DOCX المطلوبة. تحقق من المسارات: ${DATA_DIR_CANDIDATES.join(", ")}`);
}
function createGlossaryData(rows, tafsirParagraphs, tafsirDocName, indexDocName) {
    const normalizedTafsir = tafsirParagraphs.map((paragraph) => normalizeForLookup(paragraph));
    const usedIds = new Set();
    const entries = [];
    rows.forEach((row, index) => {
        const aliases = extractAliases(row.rawKeywordCellHtml);
        const fallbackTitle = aliases[0] || `مصطلح ${index + 1}`;
        const title = normalizeAuthorText(row.rawTitleCell) || fallbackTitle;
        const baseId = slugifyStable(title, `concept-${index + 1}`);
        const conceptId = toUniqueId(baseId, usedIds);
        const match = findMatchInTafsir(aliases, normalizedTafsir);
        const videos = extractUrls(row.rawVideosCell).map((url, videoIndex) => ({
            title: `فيديو ${videoIndex + 1}`,
            url,
        }));
        let paragraphs;
        let status;
        let sourceRefs;
        if (!match) {
            const placeholderText = `لا يوجد شرح مطابق تلقائياً للمصطلح «${title}». الرجاء إضافة الفقرة من المصدر يدوياً.`;
            const paragraphId = getParagraphId(conceptId, placeholderText, 1);
            paragraphs = [{ id: paragraphId, text: placeholderText, source: indexDocName }];
            status = "missing_source";
            sourceRefs = [{ file: indexDocName, hint: `row:${row.rowNumber}` }];
        }
        else {
            const selectedParagraphIndex = selectPreferredParagraphIndex(tafsirParagraphs, match.paragraphIndex);
            const matchedParagraph = tafsirParagraphs[selectedParagraphIndex];
            const paragraphId = getParagraphId(conceptId, matchedParagraph, 1);
            paragraphs = [
                {
                    id: paragraphId,
                    text: matchedParagraph,
                    source: tafsirDocName,
                },
            ];
            status = match.multiple ? "needs_review" : "ok";
            sourceRefs = [
                { file: indexDocName, hint: `row:${row.rowNumber}` },
                {
                    file: tafsirDocName,
                    hint: `paragraph:${selectedParagraphIndex + 1}; alias:${match.alias}`,
                },
            ];
        }
        entries.push({
            id: conceptId,
            title,
            aliases,
            keywords: toKeywordsFromAliases(aliases),
            paragraphs,
            defaultParagraphId: paragraphs[0].id,
            videos: videos.length ? videos : undefined,
            status,
            sourceRefs,
        });
    });
    const ordered = entries.sort(entrySort);
    const entriesRecord = {};
    ordered.forEach((entry) => {
        entriesRecord[entry.id] = entry;
    });
    return { entries: entriesRecord };
}
function findConceptByAlias(entries, aliasValue) {
    const normalized = normalizeForLookup(aliasValue);
    for (const entry of entries) {
        const haystack = [entry.title, ...entry.aliases].map((item) => normalizeForLookup(item));
        if (haystack.includes(normalized))
            return entry;
    }
    return null;
}
function normalizeArabicForToken(text) {
    return text
        .replace(/[\u064B-\u065F\u0670]/g, "")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/\s+/g, " ")
        .trim();
}
function buildTokensForAyah(text, glossary) {
    const entries = Object.values(glossary.entries);
    const aliasMap = new Map();
    for (const entry of entries) {
        const bag = [entry.title, ...entry.aliases, ...(entry.keywords ?? [])];
        for (const alias of bag) {
            const key = normalizeArabicForToken(alias);
            if (key && !aliasMap.has(key)) {
                aliasMap.set(key, { conceptId: entry.id, paragraphId: entry.defaultParagraphId });
            }
        }
    }
    const tokens = text.split(/\s+/).filter(Boolean).map((rawToken) => {
        const normalized = normalizeArabicForToken(rawToken);
        for (const [aliasKey, info] of aliasMap) {
            if (normalized === aliasKey || normalized.includes(aliasKey) || aliasKey.includes(normalized)) {
                if (normalized.length >= 2) {
                    return {
                        t: rawToken,
                        conceptId: info.conceptId,
                        paragraphId: info.paragraphId,
                        style: "red",
                    };
                }
            }
        }
        return { t: rawToken };
    });
    return tokens;
}
function createVersesData(glossary) {
    const ayahsPath = node_path_1.default.join(process.cwd(), "assets", "content copy", "ayahs.json");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ayahsRaw = require(ayahsPath);
    const verses = {};
    for (const ayah of ayahsRaw) {
        const id = `${ayah.surahId}:${ayah.ayahNumber}`;
        const tokens = buildTokensForAyah(ayah.textAr, glossary);
        verses[id] = {
            id,
            surah: parseInt(ayah.surahId),
            ayah: ayah.ayahNumber,
            text: ayah.textAr,
            tokens,
        };
    }
    return { verses };
}
async function createMethodologyData(docs) {
    const sections = [];
    const ordered = [
        { key: "intro", fallbackTitle: "تعريف التطبيق" },
        { key: "rules", fallbackTitle: "القواعد الأساسية" },
        { key: "method", fallbackTitle: "الرسم البياني للمنهج القرآني" },
        { key: "concepts", fallbackTitle: "المعاني والدلالات" },
    ];
    for (const item of ordered) {
        const sourcePath = docs[item.key];
        const sourceName = node_path_1.default.basename(sourcePath);
        const paragraphs = await extractParagraphsFromDocx(sourcePath);
        if (!paragraphs.length)
            continue;
        const title = paragraphs[0] || item.fallbackTitle;
        const content = normalizeForLookup(paragraphs[0]) === normalizeForLookup(title)
            ? paragraphs.slice(1)
            : paragraphs;
        sections.push({
            id: slugifyStable(item.key, item.key),
            title: normalizeAuthorText(title),
            content,
            source: sourceName,
        });
    }
    return { sections };
}
async function writeJsonFile(filePath, payload) {
    const content = `${JSON.stringify(payload, null, 2)}\n`;
    await promises_1.default.writeFile(filePath, content, "utf8");
}
async function run() {
    const { dataDir, docs } = await resolveDataDirAndDocs();
    await promises_1.default.mkdir(OUTPUT_DIR, { recursive: true });
    const [indexRows, tafsirParagraphs, methodologyData] = await Promise.all([
        extractIndexRowsFromDocx(docs.index),
        extractParagraphsFromDocx(docs.tafsir),
        createMethodologyData({
            intro: docs.intro,
            rules: docs.rules,
            method: docs.method,
            concepts: docs.concepts,
        }),
    ]);
    let glossaryData = createGlossaryData(indexRows, tafsirParagraphs, node_path_1.default.basename(docs.tafsir), node_path_1.default.basename(docs.index));
    if (!Object.keys(glossaryData.entries).length) {
        const fallbackGlossary = await loadFallbackGlossaryData();
        if (fallbackGlossary) {
            glossaryData = fallbackGlossary;
            console.warn("تعذر استخراج glossary.json من ملف فهرس المفردات الحالي؛ تم استخدام نسخة احتياطية غير فارغة.");
        }
        else {
            throw new Error("تعذر استخراج glossary.json من ملف فهرس المفردات الحالي، ولا توجد نسخة احتياطية صالحة.");
        }
    }
    const versesData = createVersesData(glossaryData);
    await Promise.all([
        writeJsonFile(node_path_1.default.join(OUTPUT_DIR, "glossary.json"), glossaryData),
        writeJsonFile(node_path_1.default.join(OUTPUT_DIR, "verses.json"), versesData),
        writeJsonFile(node_path_1.default.join(OUTPUT_DIR, "methodology.json"), methodologyData),
    ]);
    console.log("تم توليد البيانات بنجاح:");
    console.log(`- data dir: ${dataDir}`);
    console.log(`- glossary entries: ${Object.keys(glossaryData.entries).length}`);
    console.log(`- tafsir paragraphs scanned: ${tafsirParagraphs.length}`);
    console.log(`- methodology sections: ${methodologyData.sections.length}`);
    console.log(`- output: ${OUTPUT_DIR}`);
}
run().catch((error) => {
    console.error(error);
    process.exit(1);
});
