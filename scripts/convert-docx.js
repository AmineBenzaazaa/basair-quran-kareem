/* eslint-disable no-console */
const fs = require("fs/promises");
const path = require("path");
const mammoth = require("mammoth");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const OUT_DIR = path.join(ROOT, "assets", "content");
const COMBINING_MARKS_RE = /\p{M}/gu;

const ARTICLE_DOCS = [
  {
    candidates: ["تعريف تطبيق.docx"],
    id: "intro",
    title: "تعريف تطبيق",
    output: "intro.json",
  },
  {
    candidates: ["القواعد الأساسية.docx", "القواعد الأساسية.docx"],
    id: "rules",
    title: "القواعد الأساسية",
    output: "rules.json",
  },
  {
    candidates: [
      "الرسم البياني للمنهج القرآني.docx",
      "الرسم البياني للمنهج القرآني.docx",
    ],
    id: "method",
    title: "الرسم البياني للمنهج القرآني",
    output: "method.json",
  },
  {
    candidates: ["المعاني والدلالات.docx"],
    id: "concepts",
    title: "المعاني والدلالات",
    output: "concepts.json",
  },
];

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
};

const RULE_NUMBER_TO_DISPLAY_WORD = {
  1: "الأولى",
  2: "الثانية",
  3: "الثالثة",
  4: "الرابعة",
  5: "الخامسة",
  6: "السادسة",
  7: "السابعة",
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

async function resolveDocPath(dataDir, candidates) {
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
          Number(b.edited) - Number(a.edited) || a.file.localeCompare(b.file, "en")
      );
    if (matches[0]) {
      return path.join(dataDir, matches[0].file);
    }
  }

  return null;
}

const cleanupParagraphs = (rawText) =>
  rawText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !line.includes("w:") && !line.includes("<"));

async function extractParagraphs(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return cleanupParagraphs(result.value || "");
}

async function ensureOutputDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function writeJson(filename, payload) {
  const target = path.join(OUT_DIR, filename);
  await fs.writeFile(target, JSON.stringify(payload, null, 2), "utf8");
  console.log(`كتبنا ${filename}`);
}

function parseRuleHeading(input) {
  const line = (input || "").replace(/\s+/g, " ").trim();
  const match = line.match(
    /^(?:القاعدة|الضابط)\s+(الأولى|الأول|الثانية|الثاني|الثالثة|الثالث|الرابعة|الرابع|الخامسة|الخامس|السادسة|السادس|السابعة|السابع)\s*:\s*(.+)$/
  );

  if (!match) {
    return null;
  }

  const ruleNumber = RULE_ORDINAL_TO_NUMBER[match[1]];
  const shortTitle = match[2].trim() || line;

  return {
    heading: `القاعدة ${RULE_NUMBER_TO_DISPLAY_WORD[ruleNumber]}: ${shortTitle}`,
  };
}

function buildRuleSections(paragraphs) {
  const introParagraphs = [];
  const sections = [];
  let current = null;

  for (const paragraph of paragraphs) {
    const ruleHeading = parseRuleHeading(paragraph);
    if (ruleHeading) {
      if (current) {
        sections.push(current);
      }
      current = {
        heading: ruleHeading.heading,
        paragraphs: [],
      };
      continue;
    }

    if (current) {
      current.paragraphs.push(paragraph);
    } else {
      introParagraphs.push(paragraph);
    }
  }

  if (current) {
    sections.push(current);
  }

  if (!sections.length) {
    return [
      {
        heading: null,
        paragraphs: paragraphs.length
          ? paragraphs
          : ["تعذر استخراج النص من القواعد الأساسية."],
      },
    ];
  }

  return [
    ...(introParagraphs.length
      ? [
          {
            heading: "مقدمة",
            paragraphs: introParagraphs,
          },
        ]
      : []),
    ...sections,
  ];
}

function isConceptHeadingCandidate(line, nextLine) {
  const value = (line || "").replace(/\s+/g, " ").trim();
  const nextValue = (nextLine || "").replace(/\s+/g, " ").trim();

  if (!value) return false;
  if (value.length > 55) return false;
  if (/^[\[{(]/.test(value)) return false;
  if (/^[0-9٠-٩]/.test(value)) return false;
  if (/[.!؟؛:]$/.test(value)) return false;
  if (nextValue.length < 40) return false;

  return true;
}

function buildConceptSections(paragraphs) {
  const sections = [];
  let current = null;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const nextParagraph = paragraphs[index + 1];

    if (isConceptHeadingCandidate(paragraph, nextParagraph)) {
      if (current && (current.heading || current.paragraphs.length)) {
        sections.push(current);
      }

      current = {
        heading: paragraph,
        paragraphs: [],
      };
      continue;
    }

    if (!current) {
      current = {
        heading: null,
        paragraphs: [],
      };
    }

    current.paragraphs.push(paragraph);
  }

  if (current && (current.heading || current.paragraphs.length)) {
    sections.push(current);
  }

  if (!sections.some((section) => section.heading)) {
    return [
      {
        heading: null,
        paragraphs: paragraphs.length
          ? paragraphs
          : ["تعذر استخراج النص من المعاني والدلالات."],
      },
    ];
  }

  return sections;
}

async function buildArticles() {
  for (const doc of ARTICLE_DOCS) {
    const inputPath = await resolveDocPath(DATA_DIR, doc.candidates);
    if (!inputPath) {
      throw new Error(`تعذر العثور على ملف Word لـ ${doc.title}`);
    }
    const paragraphs = await extractParagraphs(inputPath);
    const payload = {
      id: doc.id,
      title: doc.title,
      sections:
        doc.id === "rules"
          ? buildRuleSections(paragraphs)
          : doc.id === "concepts"
            ? buildConceptSections(paragraphs)
          : [
              {
                heading: null,
                paragraphs: paragraphs.length
                  ? paragraphs
                  : [`تعذر استخراج النص من ${doc.title}.`],
              },
            ],
    };
    await writeJson(doc.output, payload);
  }
}

async function buildRawDocs() {
  const rawTargets = [
    { candidates: ["فهرس المفردات.docx"], output: "vocabulary.raw.json" },
    {
      candidates: [
        "تيسير القرآن بلسان العرب.docx",
        "تيسير القرآن بلسان العرب.docx",
      ],
      output: "tafsir.raw.json",
    },
  ];

  for (const doc of rawTargets) {
    const inputPath = await resolveDocPath(DATA_DIR, doc.candidates);
    if (!inputPath) {
      throw new Error(`تعذر العثور على ملف Word المطلوب لتوليد ${doc.output}`);
    }
    const paragraphs = await extractParagraphs(inputPath);
    const payload = {
      source: path.basename(inputPath),
      paragraphs,
      note: "هذا ملف وسيط بحاجة إلى تحويل يدوي للصيغة المطلوبة داخل التطبيق.",
    };
    await writeJson(doc.output, payload);
  }
}

async function run() {
  await ensureOutputDir();
  await buildArticles();
  await buildRawDocs();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
