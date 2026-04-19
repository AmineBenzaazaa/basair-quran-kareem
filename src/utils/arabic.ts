export const normalizeArabic = (input: string) => {
  const diacritics =
    /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  return input
    .replace(diacritics, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
};

export const includesNormalized = (text: string, query: string) => {
  if (!query.trim()) return false;
  const normalizedText = normalizeArabic(text);
  const normalizedQuery = normalizeArabic(query);
  return normalizedText.includes(normalizedQuery);
};
