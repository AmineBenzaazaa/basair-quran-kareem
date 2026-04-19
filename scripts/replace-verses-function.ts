import path from "node:path";

type GlossaryEntry = {
  id: string;
  title: string;
  aliases: string[];
  keywords?: string[];
  defaultParagraphId: string;
};

type GlossaryData = {
  entries: Record<string, GlossaryEntry>;
};

type VerseToken = {
  t: string;
  conceptId?: string;
  paragraphId?: string;
  style?: "red";
};

type Verse = {
  id: string;
  surah: number;
  ayah: number;
  text: string;
  tokens: VerseToken[];
  notes?: string;
};

type VersesData = {
  verses: Record<string, Verse>;
};

type AyahSeed = { surahId: string; ayahNumber: number; textAr: string };

function normalizeArabicForToken(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTokensForAyah(
  text: string,
  glossary: GlossaryData
): VerseToken[] {
  const entries = Object.values(glossary.entries);

  const aliasMap = new Map<string, { conceptId: string; paragraphId?: string }>();
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
            style: "red" as const,
          };
        }
      }
    }
    return { t: rawToken };
  });

  return tokens;
}

function createVersesData(glossary: GlossaryData): VersesData {
  const ayahsPath = path.join(process.cwd(), "assets", "content copy", "ayahs.json");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ayahsRaw = require(ayahsPath) as AyahSeed[];

  const verses: Record<string, Verse> = {};

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
