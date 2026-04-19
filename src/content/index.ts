import {
  createEmptyContentDocuments,
  type ContentDocuments,
} from "./documents";
import type {
  Article,
  Ayah,
  Surah,
  TafsirEntry,
  TafsirRange,
  VocabularyEntry,
} from "./types";
import { parseGlossaryContent, parseMethodContent } from "../data/models";
import { normalizeArabic } from "../utils/arabic";
import { useContentVersion } from "./version-store";

type RulesDocument = {
  title?: string;
  sections?: {
    heading?: string | null;
    paragraphs?: string[];
  }[];
};

type RuleGuideEntry = {
  id: string;
  ruleNumber: number;
  title: string;
  shortTitle: string;
  paragraphs: string[];
};

type ConceptsSection = {
  heading?: string | null;
  paragraphs?: string[];
};

type ConceptsDocument = {
  sections?: ConceptsSection[];
};

type ContentState = {
  documents: ContentDocuments;
  articles: Article[];
  rulesGuideEntries: RuleGuideEntry[];
  vocabularyEntries: VocabularyEntry[];
  surahList: Surah[];
  ayahList: Ayah[];
  tafsirEntries: TafsirEntry[];
  methodSections: ReturnType<typeof parseMethodContent>["sections"];
  getArticleById: (id: string) => Article | null;
  getRuleGuideEntryByNumber: (ruleNumber: number) => RuleGuideEntry | null;
  getVocabularyById: (id: string) => VocabularyEntry | null;
  getVocabularyExplanationParagraphsById: (id: string) => string[];
  findVocabularyByExactAlias: (alias: string) => VocabularyEntry | null;
  findVocabularyByAlias: (alias: string) => VocabularyEntry | null;
  findVocabularyForAyahText: (
    ayahText: string
  ) => { entry: VocabularyEntry; label: string } | null;
  getSurahById: (id: string) => Surah | null;
  getAyahsBySurah: (surahId: string) => Ayah[];
  getAyah: (surahId: string, ayahNumber: number) => Ayah | null;
  getTafsirEntry: (surahId: string, ayahNumber: number) => TafsirEntry | null;
  getTafsirForSurah: (surahId: string) => TafsirEntry[];
  getTafsirRangesBySurah: (surahId: string) => TafsirRange[];
  getTafsirRangeForAyah: (surahId: string, ayahNumber: number) => TafsirRange | null;
};

const RULE_HEADING_WORD_TO_NUMBER = {
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

type RuleHeadingWord = keyof typeof RULE_HEADING_WORD_TO_NUMBER;

const RULE_HEADING_REGEX =
  /^(?:القاعدة|الضابط)\s+(الأولى|الأول|الثانية|الثاني|الثالثة|الثالث|الرابعة|الرابع|الخامسة|الخامس|السادسة|السادس|السابعة|السابع)\s*:\s*(.+)$/;

const normalizeParagraphs = (paragraphs: string[]) =>
  paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean);

const parseRuleHeading = (heading: string | null) => {
  if (!heading) return null;
  const match = heading.match(RULE_HEADING_REGEX);
  if (!match) return null;

  const ruleWord = match[1] as RuleHeadingWord;
  const ruleNumber = RULE_HEADING_WORD_TO_NUMBER[ruleWord];
  const shortTitle = match[2].trim() || heading.trim();

  return {
    ruleNumber,
    shortTitle,
    heading: `القاعدة ${RULE_NUMBER_TO_DISPLAY_WORD[ruleNumber]}: ${shortTitle}`,
  };
};

const normalizeConceptLookup = (value: string) =>
  normalizeArabic(value)
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeConceptToken = (value: string) =>
  value
    .replace(/^[وفبكل](?=.{3,}$)/, "")
    .replace(/^ال(?=.{3,}$)/, "");

const toWordBagKey = (value: string) => {
  const terms = normalizeConceptLookup(value)
    .split(" ")
    .map((term) => normalizeConceptToken(term))
    .filter((term) => term.length >= 2);
  if (!terms.length) return "";
  return [...new Set(terms)].sort((a, b) => a.localeCompare(b, "ar")).join(" ");
};

const normalizeConceptHeading = (value: string) =>
  value
    .replace(/^#+\s*/, "")
    .replace(/^[*-]\s+/, "")
    .trim();

const isConceptDivider = (value: string) => /^[-_=]{3,}$/.test(value.trim());

const isGlossaryPlaceholderParagraph = (paragraph: string) => {
  const normalized = normalizeConceptLookup(paragraph);
  return normalized === "معني" || normalized === "شرح";
};

const tokenizeArabicWords = (text: string) =>
  text
    .split(/\s+/)
    .map((token) =>
      token.replace(/^[^\u0600-\u06FF]+|[^\u0600-\u06FF]+$/g, "").trim()
    )
    .filter(Boolean);

function buildContentState(documents: ContentDocuments): ContentState {
  const currentDocuments = documents;
  const glossaryData = parseGlossaryContent(currentDocuments.glossary);
  const methodData = parseMethodContent(currentDocuments["method-sections"]);

  const rawRulesSections = (((currentDocuments["rules-article"] as RulesDocument).sections) ?? [])
    .map((section) => ({
      heading:
        typeof section.heading === "string" && section.heading.trim()
          ? section.heading.trim()
          : null,
      paragraphs: (section.paragraphs ?? [])
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    }))
    .filter((section) => section.heading || section.paragraphs.length > 0);

  const normalizeRulesSections = (
    sections: Array<{ heading: string | null; paragraphs: string[] }>
  ) => {
    const hasExplicitRuleSections = sections.some((section) =>
      Boolean(parseRuleHeading(section.heading))
    );

    if (hasExplicitRuleSections) {
      return sections.map((section) => {
        const parsed = parseRuleHeading(section.heading);
        if (!parsed) return section;
        return {
          heading: parsed.heading,
          paragraphs: section.paragraphs,
        };
      });
    }

    const lines = sections.flatMap((section) => {
      const prefix =
        section.heading && section.heading !== "مقدمة" ? [section.heading] : [];
      return [...prefix, ...section.paragraphs];
    });

    const introParagraphs: string[] = [];
    const extractedSections: Array<{ heading: string; paragraphs: string[] }> = [];
    let currentRuleSection: { heading: string; paragraphs: string[] } | null = null;

    for (const line of lines) {
      const parsed = parseRuleHeading(line);
      if (parsed) {
        if (currentRuleSection) {
          extractedSections.push(currentRuleSection);
        }
        currentRuleSection = {
          heading: parsed.heading,
          paragraphs: [],
        };
        continue;
      }

      if (currentRuleSection) {
        currentRuleSection.paragraphs.push(line);
      } else {
        introParagraphs.push(line);
      }
    }

    if (currentRuleSection) {
      extractedSections.push(currentRuleSection);
    }

    if (!extractedSections.length) {
      return sections;
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
      ...extractedSections,
    ];
  };

  const rulesSections = normalizeRulesSections(rawRulesSections);

  const introRuleSection =
    rulesSections.find(
      (section) => !section.heading || !RULE_HEADING_REGEX.test(section.heading)
    ) ?? null;

  const ruleSections = rulesSections.flatMap((section) => {
    const parsed = parseRuleHeading(section.heading);
    if (!parsed) return [];

    return [
      {
        heading: parsed.heading,
        ruleNumber: parsed.ruleNumber,
        shortTitle: parsed.shortTitle,
        paragraphs: section.paragraphs,
      },
    ];
  });

  const rulesGuideEntries: RuleGuideEntry[] = ruleSections.map((section) => ({
    id: `rule-${section.ruleNumber}`,
    ruleNumber: section.ruleNumber,
    title: section.heading,
    shortTitle: section.shortTitle,
    paragraphs:
      section.ruleNumber === 1 && introRuleSection
        ? [...introRuleSection.paragraphs, ...section.paragraphs]
        : [...section.paragraphs],
  }));

  const rulesArticle: Article = {
    id: "rules",
    title: "القواعد الأساسية",
    sections: rulesSections.map((section) => ({
      heading: section.heading,
      paragraphs: section.paragraphs,
    })),
  };

  const methodArticle: Article = {
    id: "method",
    title: "الرسم البياني للمنهج القرآني",
    sections: methodData.sections.map((section) => ({
      heading: section.title,
      paragraphs: section.content,
    })),
  };

  const articles = [
    currentDocuments.intro as Article,
    rulesArticle,
    methodArticle,
  ] as Article[];

  const vocabularyEntries = Object.values(glossaryData.entries)
    .map(
      (entry) =>
        ({
          id: entry.id,
          phrase: entry.title,
          variants: entry.aliases,
          keywords: entry.keywords,
          explanation: entry.paragraphs.map((paragraph) => paragraph.text).join("\n\n"),
          videoUrls: entry.videos?.map((video) => video.url) ?? [],
        }) as VocabularyEntry
    )
    .sort((a, b) => a.phrase.localeCompare(b.phrase, "ar"));

  const vocabularyById = new Map<string, VocabularyEntry>(
    vocabularyEntries.map((entry) => [entry.id, entry])
  );

  const vocabAliasToId = new Map<string, string>();
  const vocabExactAliasToId = new Map<string, string>();
  for (const entry of vocabularyEntries) {
    const labels = [entry.phrase, ...(entry.variants ?? []), ...(entry.keywords ?? [])];
    for (const label of labels) {
      const normalized = normalizeArabic(label).trim();
      if (normalized && normalized.length >= 3 && !vocabAliasToId.has(normalized)) {
        vocabAliasToId.set(normalized, entry.id);
      }
      if (
        normalized &&
        normalized.length >= 3 &&
        !vocabExactAliasToId.has(normalized)
      ) {
        vocabExactAliasToId.set(normalized, entry.id);
      }
    }
  }

  const conceptHeadingExactToId = new Map<string, string>();
  const conceptHeadingWordBagToId = new Map<string, string>();
  for (const entry of vocabularyEntries) {
    const labels = [entry.phrase, ...(entry.variants ?? []), ...(entry.keywords ?? [])];
    for (const label of labels) {
      const exactKey = normalizeConceptLookup(label);
      if (exactKey && !conceptHeadingExactToId.has(exactKey)) {
        conceptHeadingExactToId.set(exactKey, entry.id);
      }

      const wordBagKey = toWordBagKey(label);
      if (
        wordBagKey &&
        wordBagKey.includes(" ") &&
        !conceptHeadingWordBagToId.has(wordBagKey)
      ) {
        conceptHeadingWordBagToId.set(wordBagKey, entry.id);
      }
    }
  }

  const resolveConceptHeadingEntryId = (line: string) => {
    const exactKey = normalizeConceptLookup(line);
    if (!exactKey) return null;

    const exactMatchId = conceptHeadingExactToId.get(exactKey);
    if (exactMatchId) return exactMatchId;

    const wordBagKey = toWordBagKey(line);
    if (!wordBagKey) return null;

    return conceptHeadingWordBagToId.get(wordBagKey) ?? null;
  };

  const rawConceptSections = ((((currentDocuments.concepts as ConceptsDocument).sections) ?? [])
    .map((section) => ({
      heading:
        typeof section.heading === "string" && section.heading.trim()
          ? normalizeConceptHeading(section.heading)
          : null,
      paragraphs: (section.paragraphs ?? [])
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    }))
    .filter((section) => section.heading || section.paragraphs.length > 0));

  const expandFlatConceptSections = (
    sections: Array<{ heading: string | null; paragraphs: string[] }>
  ) => {
    if (sections.some((section) => section.heading)) {
      return sections;
    }

    const introParagraphs: string[] = [];
    const parsedSections: Array<{ heading: string | null; paragraphs: string[] }> = [];
    let currentSection: { heading: string | null; paragraphs: string[] } | null = null;

    for (const line of sections.flatMap((section) => section.paragraphs)) {
      const normalizedLine = normalizeConceptHeading(line);
      if (!normalizedLine || isConceptDivider(normalizedLine)) {
        continue;
      }

      const headingEntryId = resolveConceptHeadingEntryId(normalizedLine);
      if (headingEntryId) {
        if (currentSection?.paragraphs.length) {
          parsedSections.push(currentSection);
        }
        currentSection = {
          heading: normalizedLine,
          paragraphs: [],
        };
        continue;
      }

      if (currentSection) {
        currentSection.paragraphs.push(normalizedLine);
      } else if (normalizedLine !== "القسم") {
        introParagraphs.push(normalizedLine);
      }
    }

    if (currentSection?.paragraphs.length) {
      parsedSections.push(currentSection);
    }

    if (!parsedSections.length) {
      return sections;
    }

    return [
      ...(introParagraphs.length
        ? [
            {
              heading: null,
              paragraphs: introParagraphs,
            },
          ]
        : []),
      ...parsedSections,
    ];
  };

  const conceptSections = expandFlatConceptSections(rawConceptSections);

  const conceptParagraphsByEntryId = new Map<string, string[]>();
  for (const section of conceptSections) {
    if (!section.heading) continue;

    const headingEntryId = resolveConceptHeadingEntryId(section.heading);
    if (!headingEntryId) continue;

    const currentParagraphs = conceptParagraphsByEntryId.get(headingEntryId) ?? [];
    conceptParagraphsByEntryId.set(headingEntryId, [
      ...currentParagraphs,
      ...section.paragraphs,
    ]);
  }

  const surahList = currentDocuments.surahs as Surah[];
  const ayahList = currentDocuments.ayahs as Ayah[];
  const tafsirEntries = currentDocuments.tafsir as TafsirEntry[];

  const ayahsBySurah = new Map<string, Ayah[]>();
  const ayahByKey = new Map<string, Ayah>();
  for (const ayah of ayahList) {
    const bag = ayahsBySurah.get(ayah.surahId);
    if (bag) {
      bag.push(ayah);
    } else {
      ayahsBySurah.set(ayah.surahId, [ayah]);
    }
    ayahByKey.set(`${ayah.surahId}:${ayah.ayahNumber}`, ayah);
  }
  for (const [surahId, list] of ayahsBySurah) {
    ayahsBySurah.set(
      surahId,
      [...list].sort((a, b) => a.ayahNumber - b.ayahNumber)
    );
  }

  const tafsirBySurah = new Map<string, TafsirEntry[]>();
  const tafsirByKey = new Map<string, TafsirEntry>();
  for (const entry of tafsirEntries) {
    const bag = tafsirBySurah.get(entry.surahId);
    if (bag) {
      bag.push(entry);
    } else {
      tafsirBySurah.set(entry.surahId, [entry]);
    }
    tafsirByKey.set(`${entry.surahId}:${entry.ayahNumber}`, entry);
  }
  for (const [surahId, list] of tafsirBySurah) {
    tafsirBySurah.set(
      surahId,
      [...list].sort((a, b) => a.ayahNumber - b.ayahNumber)
    );
  }

  const tafsirRangesBySurah = new Map<string, TafsirRange[]>();
  const tafsirRangeByAyahKey = new Map<string, TafsirRange>();
  const buildTafsirRangesForSurah = (surahId: string) => {
    const cachedRanges = tafsirRangesBySurah.get(surahId);
    if (cachedRanges) return cachedRanges;

    const surahAyahs = ayahsBySurah.get(surahId) ?? [];
    const tafsirForSurah = tafsirBySurah.get(surahId) ?? [];
    const tafsirByAyahNumber = new Map<number, string[]>(
      tafsirForSurah.map((item) => [item.ayahNumber, item.tafsirParagraphs])
    );

    const ranges: TafsirRange[] = [];
    let activeRange: TafsirRange | null = null;
    let activeTafsirSignature = "";

    for (const ayah of surahAyahs) {
      const tafsirParagraphs = normalizeParagraphs(
        tafsirByAyahNumber.get(ayah.ayahNumber) ?? []
      );
      const tafsirSignature = tafsirParagraphs.join("\n__tafsir_range_sep__\n");

      const extendsActiveRange =
        activeRange &&
        ayah.ayahNumber === activeRange.endAyahNumber + 1 &&
        tafsirSignature === activeTafsirSignature;

      if (extendsActiveRange && activeRange) {
        activeRange.endAyahNumber = ayah.ayahNumber;
        activeRange.ayahs.push(ayah);
        continue;
      }

      if (activeRange) {
        ranges.push(activeRange);
      }

      activeRange = {
        surahId,
        startAyahNumber: ayah.ayahNumber,
        endAyahNumber: ayah.ayahNumber,
        ayahs: [ayah],
        tafsirParagraphs,
      };
      activeTafsirSignature = tafsirSignature;
    }

    if (activeRange) {
      ranges.push(activeRange);
    }

    tafsirRangesBySurah.set(surahId, ranges);
    for (const range of ranges) {
      for (const ayah of range.ayahs) {
        tafsirRangeByAyahKey.set(`${range.surahId}:${ayah.ayahNumber}`, range);
      }
    }

    return ranges;
  };

  const getArticleById = (id: string) =>
    articles.find((item) => item.id === id) ?? null;

  const getRuleGuideEntryByNumber = (ruleNumber: number) =>
    rulesGuideEntries.find((entry) => entry.ruleNumber === ruleNumber) ?? null;

  const getVocabularyById = (id: string) => vocabularyById.get(id) ?? null;

  const getVocabularyExplanationParagraphsById = (id: string) => {
    const conceptParagraphsForEntry = conceptParagraphsByEntryId.get(id);
    if (conceptParagraphsForEntry && conceptParagraphsForEntry.length > 0) {
      return normalizeParagraphs(conceptParagraphsForEntry);
    }

    const glossaryEntry = glossaryData.entries[id];
    if (glossaryEntry) {
      const glossaryParagraphs = normalizeParagraphs(
        glossaryEntry.paragraphs.map((paragraph) => paragraph.text)
      ).filter((paragraph) => !isGlossaryPlaceholderParagraph(paragraph));
      if (glossaryParagraphs.length > 0) {
        return glossaryParagraphs;
      }
    }

    const explanation = getVocabularyById(id)?.explanation ?? "";
    return normalizeParagraphs(explanation.split(/\n+/));
  };

  const findVocabularyByExactAlias = (alias: string) => {
    const normalized = normalizeArabic(alias).trim();
    if (!normalized || normalized.length < 3) return null;
    const id = vocabExactAliasToId.get(normalized);
    if (!id) return null;
    return getVocabularyById(id);
  };

  const findVocabularyByAlias = (alias: string) => {
    const normalized = normalizeArabic(alias);
    if (!normalized || normalized.length < 3) return null;
    const id = vocabAliasToId.get(normalized);
    if (!id) return null;
    return getVocabularyById(id);
  };

  const findVocabularyForAyahText = (ayahText: string) => {
    const normalizedAyah = normalizeArabic(ayahText).trim();
    if (!normalizedAyah) return null;

    let bestPhraseMatch:
      | { entryId: string; label: string; score: number }
      | null = null;

    for (const entry of vocabularyEntries) {
      const aliases = [entry.phrase, ...(entry.variants ?? [])];
      for (const alias of aliases) {
        const normalizedAlias = normalizeArabic(alias).trim();
        if (!normalizedAlias || normalizedAlias.length < 3) continue;
        if (!normalizedAyah.includes(normalizedAlias)) continue;
        if (normalizedAlias.split(/\s+/).length < 2) continue;

        const score =
          normalizedAlias.length +
          (normalizeArabic(entry.phrase).trim() === normalizedAlias ? 50 : 0);

        if (!bestPhraseMatch || score > bestPhraseMatch.score) {
          bestPhraseMatch = {
            entryId: entry.id,
            label: alias.trim(),
            score,
          };
        }
      }
    }

    if (bestPhraseMatch) {
      const entry = getVocabularyById(bestPhraseMatch.entryId);
      if (entry) {
        return { entry, label: bestPhraseMatch.label };
      }
    }

    const seenTokens = new Set<string>();
    for (const token of tokenizeArabicWords(ayahText)) {
      const normalizedToken = normalizeArabic(token).trim();
      if (!normalizedToken || normalizedToken.length < 5) continue;
      if (seenTokens.has(normalizedToken)) continue;
      seenTokens.add(normalizedToken);

      const entry = findVocabularyByExactAlias(token);
      if (entry) {
        return { entry, label: token };
      }
    }

    return null;
  };

  const getSurahById = (id: string) =>
    surahList.find((item) => item.id === id) ?? null;

  const getAyahsBySurah = (surahId: string) =>
    ayahsBySurah.get(surahId) ?? [];

  const getAyah = (surahId: string, ayahNumber: number) =>
    ayahByKey.get(`${surahId}:${ayahNumber}`) ?? null;

  const getTafsirEntry = (surahId: string, ayahNumber: number) =>
    tafsirByKey.get(`${surahId}:${ayahNumber}`) ?? null;

  const getTafsirForSurah = (surahId: string) =>
    tafsirBySurah.get(surahId) ?? [];

  const getTafsirRangesBySurah = (surahId: string) =>
    buildTafsirRangesForSurah(surahId);

  const getTafsirRangeForAyah = (surahId: string, ayahNumber: number) =>
    tafsirRangeByAyahKey.get(`${surahId}:${ayahNumber}`) ??
    buildTafsirRangesForSurah(surahId).find(
      (range) =>
        ayahNumber >= range.startAyahNumber && ayahNumber <= range.endAyahNumber
    ) ??
    null;

  return {
    documents: currentDocuments,
    articles,
    rulesGuideEntries,
    vocabularyEntries,
    surahList,
    ayahList,
    tafsirEntries,
    methodSections: methodData.sections,
    getArticleById,
    getRuleGuideEntryByNumber,
    getVocabularyById,
    getVocabularyExplanationParagraphsById,
    findVocabularyByExactAlias,
    findVocabularyByAlias,
    findVocabularyForAyahText,
    getSurahById,
    getAyahsBySurah,
    getAyah,
    getTafsirEntry,
    getTafsirForSurah,
    getTafsirRangesBySurah,
    getTafsirRangeForAyah,
  };
}

let contentState = buildContentState(createEmptyContentDocuments());

export function applyContentDocuments(documents: ContentDocuments) {
  contentState = buildContentState(documents);
}

export function getContentData() {
  return contentState;
}

export function useContentData() {
  useContentVersion();
  return contentState;
}

export const getArticleById = (id: string) => contentState.getArticleById(id);

export const getRuleGuideEntryByNumber = (ruleNumber: number) =>
  contentState.getRuleGuideEntryByNumber(ruleNumber);

export const getVocabularyById = (id: string) =>
  contentState.getVocabularyById(id);

export const getVocabularyExplanationParagraphsById = (id: string) =>
  contentState.getVocabularyExplanationParagraphsById(id);

export const findVocabularyByExactAlias = (alias: string) =>
  contentState.findVocabularyByExactAlias(alias);

export const findVocabularyByAlias = (alias: string) =>
  contentState.findVocabularyByAlias(alias);

export const findVocabularyForAyahText = (ayahText: string) =>
  contentState.findVocabularyForAyahText(ayahText);

export const getSurahById = (id: string) => contentState.getSurahById(id);

export const getAyahsBySurah = (surahId: string) =>
  contentState.getAyahsBySurah(surahId);

export const getAyah = (surahId: string, ayahNumber: number) =>
  contentState.getAyah(surahId, ayahNumber);

export const getTafsirEntry = (surahId: string, ayahNumber: number) =>
  contentState.getTafsirEntry(surahId, ayahNumber);

export const getTafsirForSurah = (surahId: string) =>
  contentState.getTafsirForSurah(surahId);

export const getTafsirRangesBySurah = (surahId: string) =>
  contentState.getTafsirRangesBySurah(surahId);

export const getTafsirRangeForAyah = (surahId: string, ayahNumber: number) =>
  contentState.getTafsirRangeForAyah(surahId, ayahNumber);
