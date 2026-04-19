from __future__ import annotations

import re


ARABIC_CHAR_PATTERN = re.compile(r"[\u0600-\u06FF]")
URL_PATTERN = re.compile(r"https?://\S+")
YOUTUBE_PATTERN = re.compile(r"https?://(?:www\.)?(?:youtube\.com|youtu\.be)/\S+")
ENCODING_PATTERN = re.compile(r"\uFFFD|�")
FATWA_CERTAINTY_PATTERN = re.compile(
    r"(?:يتقرر|يحرم\s+شرعاً|يجب\s+شرعاً|لا\s+يجوز\s+شرعاً|أجمع\s+العلماء|الإسلام\s+يقول)"
)
HADITH_MARKER_PATTERN = re.compile(
    r"(?:قال\s+رسول\s+الله|عن\s+أبي\s+هريرة|رواه|أخرجه|حديث)\b"
)
ANTI_MADHHAB_PATTERN = re.compile(
    r"(?:بمنأى\s+عن\s+المذاهب|لا\s+نحتاج\s+إلى\s+المذاهب|المذاهب\s+اللاحقة|التقليد\s+الأعمى)\b"
)
TAKFIR_DIRECT_PATTERN = re.compile(
    r"(?:فهو|فهم|فهي|هذا|هذه|هؤلاء|كل\s+من)\s+(?:كافر|كفار|مرتد|زنديق|مشرك)\b|"
    r"(?:يكفر|تكفير)\s+\S+"
)
SCIENTIFIC_CERTAINTY_PATTERN = re.compile(
    r"(?:أثبت\s+العلم|تؤكد\s+الكوزمولوجيا|ثبت\s+علمياً|حقيقة\s+علمية)\b"
)
NOVEL_DEFINITION_PATTERN = re.compile(
    r"(?:المقصود\s+ب|معنى\s+)\s*(?:الإسلام|الإيمان|الكفر|الشرك)\s*(?:هو|يعني)\b"
)
PROMPT_FATWA_PATTERN = re.compile(
    r"(?:issue\s+fatwas?|absolute\s+rulings?|أفت(?:ِ|ي|نا)?|أصدر\s+حكماً)",
    re.IGNORECASE,
)
EVIDENCE_MARKER_PATTERN = re.compile(
    r"(?:QURAN:\s*\d+:\d+|TAFSIR:\s*.+?\|.+?\|.+?|HADITH:\s*.+?grading=.+?grader=.+?|FIQH:\s*.+?\|.+?\|.+?)",
    re.IGNORECASE,
)
SOURCE_KEY_PATTERN = re.compile(
    r'"(?:source|sources|citation|citations|grader|grading|madhhab|scholar_approval_id)"\s*:',
    re.IGNORECASE,
)
CLASSICAL_TAFSIR_PATTERN = re.compile(
    r"(?:الطبري|ابن\s+كثير|القرطبي|البغوي|Tabari|Ibn\s+Kathir|Qurtubi|Baghawi)",
    re.IGNORECASE,
)
PROMPT_KEYWORD_PATTERN = re.compile(
    r"(?:prompt|system|fatwa|ruling|scholar)", re.IGNORECASE
)
