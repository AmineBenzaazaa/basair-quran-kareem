/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import * as mammoth from "mammoth";

type SurahMeta = {
  id: string;
  nameAr: string;
  ayahCount: number;
};

type AyahItem = {
  surahId: string;
  ayahNumber: number;
  textAr: string;
};

type TafsirItem = {
  surahId: string;
  ayahNumber: number;
  tafsirParagraphs: string[];
};

type VerseOverride = {
  ayahText?: string;
  tafsirParagraphs?: string[];
};

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR_CANDIDATES = [
  process.env.DATA_DIR,
  path.join(ROOT_DIR, "data"),
  "/mnt/data",
].filter(Boolean) as string[];
const DOC_NAMES = [
  "تيسير القرآن بلسان العرب.docx",
  "تيسير القرآن بلسان العرب.docx",
] as const;
const OUTPUT_DIR = path.join(ROOT_DIR, "assets", "content");
const COMBINING_MARKS_RE = /\p{M}/gu;
const VERSE_OVERRIDES: Record<string, VerseOverride> = {
  "7:68": {
    ayahText: "أُبَلِّغُكُمْ رِسَالاتِ رَبِّي وَأَنَا لَكُمْ نَاصِحٌ أَمِينٌ",
    tafsirParagraphs: [
      "إنما أبلّغكم ما أوحاه إليّ ربي من رسالاته، وأنا أنصح لكم بإخلاص وأؤدي ما كُلِّفت به بأمانة، فلا أريد لكم إلا الهداية والنجاة من العذاب.",
    ],
  },
};

const SURAHS: SurahMeta[] = [
  { id: "1", nameAr: "الفاتحة", ayahCount: 7 },
  { id: "2", nameAr: "البقرة", ayahCount: 286 },
  { id: "3", nameAr: "آل عمران", ayahCount: 200 },
  { id: "4", nameAr: "النساء", ayahCount: 176 },
  { id: "5", nameAr: "المائدة", ayahCount: 120 },
  { id: "6", nameAr: "الأنعام", ayahCount: 165 },
  { id: "7", nameAr: "الأعراف", ayahCount: 206 },
  { id: "8", nameAr: "الأنفال", ayahCount: 75 },
  { id: "9", nameAr: "التوبة", ayahCount: 129 },
  { id: "10", nameAr: "يونس", ayahCount: 109 },
  { id: "11", nameAr: "هود", ayahCount: 123 },
  { id: "12", nameAr: "يوسف", ayahCount: 111 },
  { id: "13", nameAr: "الرعد", ayahCount: 43 },
  { id: "14", nameAr: "إبراهيم", ayahCount: 52 },
  { id: "15", nameAr: "الحجر", ayahCount: 99 },
  { id: "16", nameAr: "النحل", ayahCount: 128 },
  { id: "17", nameAr: "الإسراء", ayahCount: 111 },
  { id: "18", nameAr: "الكهف", ayahCount: 110 },
  { id: "19", nameAr: "مريم", ayahCount: 98 },
  { id: "20", nameAr: "طه", ayahCount: 135 },
  { id: "21", nameAr: "الأنبياء", ayahCount: 112 },
  { id: "22", nameAr: "الحج", ayahCount: 78 },
  { id: "23", nameAr: "المؤمنون", ayahCount: 118 },
  { id: "24", nameAr: "النور", ayahCount: 64 },
  { id: "25", nameAr: "الفرقان", ayahCount: 77 },
  { id: "26", nameAr: "الشعراء", ayahCount: 227 },
  { id: "27", nameAr: "النمل", ayahCount: 93 },
  { id: "28", nameAr: "القصص", ayahCount: 88 },
  { id: "29", nameAr: "العنكبوت", ayahCount: 69 },
  { id: "30", nameAr: "الروم", ayahCount: 60 },
  { id: "31", nameAr: "لقمان", ayahCount: 34 },
  { id: "32", nameAr: "السجدة", ayahCount: 30 },
  { id: "33", nameAr: "الأحزاب", ayahCount: 73 },
  { id: "34", nameAr: "سبأ", ayahCount: 54 },
  { id: "35", nameAr: "فاطر", ayahCount: 45 },
  { id: "36", nameAr: "يس", ayahCount: 83 },
  { id: "37", nameAr: "الصافات", ayahCount: 182 },
  { id: "38", nameAr: "ص", ayahCount: 88 },
  { id: "39", nameAr: "الزمر", ayahCount: 75 },
  { id: "40", nameAr: "غافر", ayahCount: 85 },
  { id: "41", nameAr: "فصلت", ayahCount: 54 },
  { id: "42", nameAr: "الشورى", ayahCount: 53 },
  { id: "43", nameAr: "الزخرف", ayahCount: 89 },
  { id: "44", nameAr: "الدخان", ayahCount: 59 },
  { id: "45", nameAr: "الجاثية", ayahCount: 37 },
  { id: "46", nameAr: "الأحقاف", ayahCount: 35 },
  { id: "47", nameAr: "محمد", ayahCount: 38 },
  { id: "48", nameAr: "الفتح", ayahCount: 29 },
  { id: "49", nameAr: "الحجرات", ayahCount: 18 },
  { id: "50", nameAr: "ق", ayahCount: 45 },
  { id: "51", nameAr: "الذاريات", ayahCount: 60 },
  { id: "52", nameAr: "الطور", ayahCount: 49 },
  { id: "53", nameAr: "النجم", ayahCount: 62 },
  { id: "54", nameAr: "القمر", ayahCount: 55 },
  { id: "55", nameAr: "الرحمن", ayahCount: 78 },
  { id: "56", nameAr: "الواقعة", ayahCount: 96 },
  { id: "57", nameAr: "الحديد", ayahCount: 29 },
  { id: "58", nameAr: "المجادلة", ayahCount: 22 },
  { id: "59", nameAr: "الحشر", ayahCount: 24 },
  { id: "60", nameAr: "الممتحنة", ayahCount: 13 },
  { id: "61", nameAr: "الصف", ayahCount: 14 },
  { id: "62", nameAr: "الجمعة", ayahCount: 11 },
  { id: "63", nameAr: "المنافقون", ayahCount: 11 },
  { id: "64", nameAr: "التغابن", ayahCount: 18 },
  { id: "65", nameAr: "الطلاق", ayahCount: 12 },
  { id: "66", nameAr: "التحريم", ayahCount: 12 },
  { id: "67", nameAr: "الملك", ayahCount: 30 },
  { id: "68", nameAr: "القلم", ayahCount: 52 },
  { id: "69", nameAr: "الحاقة", ayahCount: 52 },
  { id: "70", nameAr: "المعارج", ayahCount: 44 },
  { id: "71", nameAr: "نوح", ayahCount: 28 },
  { id: "72", nameAr: "الجن", ayahCount: 28 },
  { id: "73", nameAr: "المزمل", ayahCount: 20 },
  { id: "74", nameAr: "المدثر", ayahCount: 56 },
  { id: "75", nameAr: "القيامة", ayahCount: 40 },
  { id: "76", nameAr: "الإنسان", ayahCount: 31 },
  { id: "77", nameAr: "المرسلات", ayahCount: 50 },
  { id: "78", nameAr: "النبأ", ayahCount: 40 },
  { id: "79", nameAr: "النازعات", ayahCount: 46 },
  { id: "80", nameAr: "عبس", ayahCount: 42 },
  { id: "81", nameAr: "التكوير", ayahCount: 29 },
  { id: "82", nameAr: "الانفطار", ayahCount: 19 },
  { id: "83", nameAr: "المطففين", ayahCount: 36 },
  { id: "84", nameAr: "الانشقاق", ayahCount: 25 },
  { id: "85", nameAr: "البروج", ayahCount: 22 },
  { id: "86", nameAr: "الطارق", ayahCount: 17 },
  { id: "87", nameAr: "الأعلى", ayahCount: 19 },
  { id: "88", nameAr: "الغاشية", ayahCount: 26 },
  { id: "89", nameAr: "الفجر", ayahCount: 30 },
  { id: "90", nameAr: "البلد", ayahCount: 20 },
  { id: "91", nameAr: "الشمس", ayahCount: 15 },
  { id: "92", nameAr: "الليل", ayahCount: 21 },
  { id: "93", nameAr: "الضحى", ayahCount: 11 },
  { id: "94", nameAr: "الشرح", ayahCount: 8 },
  { id: "95", nameAr: "التين", ayahCount: 8 },
  { id: "96", nameAr: "العلق", ayahCount: 19 },
  { id: "97", nameAr: "القدر", ayahCount: 5 },
  { id: "98", nameAr: "البينة", ayahCount: 8 },
  { id: "99", nameAr: "الزلزلة", ayahCount: 8 },
  { id: "100", nameAr: "العاديات", ayahCount: 11 },
  { id: "101", nameAr: "القارعة", ayahCount: 11 },
  { id: "102", nameAr: "التكاثر", ayahCount: 8 },
  { id: "103", nameAr: "العصر", ayahCount: 3 },
  { id: "104", nameAr: "الهمزة", ayahCount: 9 },
  { id: "105", nameAr: "الفيل", ayahCount: 5 },
  { id: "106", nameAr: "قريش", ayahCount: 4 },
  { id: "107", nameAr: "الماعون", ayahCount: 7 },
  { id: "108", nameAr: "الكوثر", ayahCount: 3 },
  { id: "109", nameAr: "الكافرون", ayahCount: 6 },
  { id: "110", nameAr: "النصر", ayahCount: 3 },
  { id: "111", nameAr: "المسد", ayahCount: 5 },
  { id: "112", nameAr: "الإخلاص", ayahCount: 4 },
  { id: "113", nameAr: "الفلق", ayahCount: 5 },
  { id: "114", nameAr: "الناس", ayahCount: 6 },
];

function normalizeLine(input: string): string {
  return input
    .replace(/\u00A0/g, " ")
    .replace(/\u200F|\u200E/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

async function resolveDataDocPath(): Promise<string> {
  for (const dir of DATA_DIR_CANDIDATES) {
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const files = await fs.readdir(dir);
    const normalized = files.map((file) => ({
      file,
      normalized: normalizeForFilenameMatch(file),
      edited: isEditedFilename(file),
    }));

    for (const candidate of DOC_NAMES) {
      const target = normalizeForFilenameMatch(candidate);
      const matches = normalized
        .filter((item) => item.normalized === target)
        .sort(
          (a, b) =>
            Number(b.edited) - Number(a.edited) ||
            a.file.localeCompare(b.file, "en")
        );
      if (matches[0]) {
        return path.join(dir, matches[0].file);
      }
    }
  }

  throw new Error(
    `لم يتم العثور على ملف DOCX المطلوب. تحقق من المسارات: ${DATA_DIR_CANDIDATES.join(
      ", "
    )}`
  );
}

function normalizeKey(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\p{M}]/gu, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isVerseLine(line: string): boolean {
  if (!/\(\d{1,3}\)\s*$/.test(line)) return false;
  if (/^(الآية|آية|في الآية|تشير الآية|من الجدير|القاعدة|المصدر)/.test(line)) {
    return false;
  }
  return true;
}

function uniqueParagraphs(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const value = normalizeLine(line);
    if (!value || value === "." || value === ":") continue;
    if (out[out.length - 1] === value) continue;
    out.push(value);
  }
  return out;
}

async function writeJson(filePath: string, payload: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function run() {
  const dataDocPath = await resolveDataDocPath();
  const raw = await mammoth.extractRawText({ path: dataDocPath });
  const lines = raw.value.split("\n").map(normalizeLine).filter(Boolean);

  const surahByKey = new Map<string, SurahMeta>(
    SURAHS.map((surah) => [normalizeKey(surah.nameAr), surah])
  );

  let currentSurah: SurahMeta | null = null;
  let currentAyahGroup: number[] = [];

  const ayahTextMap = new Map<string, string>();
  const tafsirMap = new Map<string, string[]>();

  for (const line of lines) {
    const surah = surahByKey.get(normalizeKey(line));
    if (surah) {
      currentSurah = surah;
      currentAyahGroup = [];
      continue;
    }

    if (!currentSurah) continue;

    if (isVerseLine(line)) {
      const ayahNumbers = [...line.matchAll(/\((\d{1,3})\)/g)]
        .map((match) => Number.parseInt(match[1], 10))
        .filter((value) => value >= 1 && value <= currentSurah!.ayahCount);

      currentAyahGroup = [...new Set(ayahNumbers)];
      for (const ayahNumber of currentAyahGroup) {
        const key = `${currentSurah.id}:${ayahNumber}`;
        if (!tafsirMap.has(key)) {
          tafsirMap.set(key, []);
        }
      }

      const ayahSegments = [...line.matchAll(/([^()]+?)\((\d{1,3})\)/g)];
      for (const segment of ayahSegments) {
        const ayahNumber = Number.parseInt(segment[2], 10);
        if (ayahNumber < 1 || ayahNumber > currentSurah.ayahCount) continue;
        const text = normalizeLine(segment[1]);
        if (!text) continue;

        const key = `${currentSurah.id}:${ayahNumber}`;
        if (!ayahTextMap.has(key)) {
          ayahTextMap.set(key, text);
        }
      }
      continue;
    }

    if (!currentAyahGroup.length) continue;
    for (const ayahNumber of currentAyahGroup) {
      const key = `${currentSurah.id}:${ayahNumber}`;
      const existing = tafsirMap.get(key) ?? [];
      existing.push(line);
      tafsirMap.set(key, existing);
    }
  }

  const ayahs: AyahItem[] = [];
  const tafsir: TafsirItem[] = [];

  let placeholderAyahCount = 0;
  let placeholderTafsirCount = 0;

  for (const surah of SURAHS) {
    for (let ayahNumber = 1; ayahNumber <= surah.ayahCount; ayahNumber += 1) {
      const key = `${surah.id}:${ayahNumber}`;
      const text = ayahTextMap.get(key);
      const parsedParagraphs = uniqueParagraphs(tafsirMap.get(key) ?? []);
      const override = VERSE_OVERRIDES[key];

      const ayahText =
        text ??
        override?.ayahText ??
        `نص الآية ${surah.id}:${ayahNumber} غير متوفر في مصدر تيسير الحالي.`;
      const tafsirParagraphs =
        parsedParagraphs.length > 0
          ? parsedParagraphs
          : override?.tafsirParagraphs?.length
            ? override.tafsirParagraphs
          : [`شرح الآية ${surah.id}:${ayahNumber} غير متوفر في مصدر تيسير الحالي.`];

      if (!text && !override?.ayahText) placeholderAyahCount += 1;
      if (!parsedParagraphs.length && !override?.tafsirParagraphs?.length) {
        placeholderTafsirCount += 1;
      }

      ayahs.push({
        surahId: surah.id,
        ayahNumber,
        textAr: ayahText,
      });

      tafsir.push({
        surahId: surah.id,
        ayahNumber,
        tafsirParagraphs,
      });
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    writeJson(path.join(OUTPUT_DIR, "surahs.json"), SURAHS),
    writeJson(path.join(OUTPUT_DIR, "ayahs.json"), ayahs),
    writeJson(path.join(OUTPUT_DIR, "tafsir.json"), tafsir),
  ]);

  console.log("تم توليد بيانات القرآن والتفسير بنجاح:");
  console.log(`- source doc: ${dataDocPath}`);
  console.log(`- surahs: ${SURAHS.length}`);
  console.log(`- ayahs: ${ayahs.length}`);
  console.log(`- tafsir entries: ${tafsir.length}`);
  console.log(`- placeholder ayah texts: ${placeholderAyahCount}`);
  console.log(`- placeholder tafsir entries: ${placeholderTafsirCount}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
