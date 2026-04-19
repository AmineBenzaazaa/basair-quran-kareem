"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type VerseToken = {
  t: string;
  conceptId?: string;
  paragraphId?: string;
  style?: "red";
};

type VerseData = {
  id: string;
  surah: number;
  ayah: number;
  text: string;
  tokens: VerseToken[];
};

type VersesTokensData = {
  version: number;
  verses: Record<string, VerseData>;
  glossaryEntries?: GlossaryEntry[];
};

type GlossaryEntry = {
  id: string;
  title: string;
  aliases: string[];
  keywords: string[];
  paragraphs: Array<{ id: string; text: string }>;
  defaultParagraphId?: string;
};

type SurahInfo = {
  id: number;
  nameAr: string;
  ayahCount: number;
};

type TokenEditorProps = {
  initialData?: VersesTokensData | null;
  onSave: (data: VersesTokensData) => Promise<void>;
};

type TokenConceptPickerProps = {
  tokenText: string;
  currentConceptId?: string;
  entries: GlossaryEntry[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (conceptId: string) => void;
};

const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

const normalizeSearchText = (value: string) =>
  value
    .replace(ARABIC_DIACRITICS_RE, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .trim();

function TokenConceptPicker({
  tokenText,
  currentConceptId,
  entries,
  isOpen,
  onOpen,
  onClose,
  onSelect,
}: TokenConceptPickerProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const currentConcept = entries.find((entry) => entry.id === currentConceptId) ?? null;

  const filteredEntries = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    const sortedEntries = [...entries].sort((a, b) =>
      a.title.localeCompare(b.title, "ar")
    );

    if (!normalizedQuery) {
      return sortedEntries;
    }

    return sortedEntries.filter((entry) => {
      const haystack = [
        entry.title,
        ...entry.aliases,
        ...entry.keywords,
        entry.id,
      ]
        .map(normalizeSearchText)
        .join(" ");
      return haystack.includes(normalizedQuery);
    });
  }, [entries, query]);

  return (
    <div className="vt-token-picker">
      <button
        className={`vt-token-picker-trigger ${isOpen ? "vt-token-picker-trigger-open" : ""}`}
        type="button"
        onClick={() => (isOpen ? onClose() : onOpen())}
        title="ابحث عن المفردة المرتبطة"
      >
        <span className="vt-token-picker-label">
          {currentConcept?.title ?? "اختر مفردة"}
        </span>
      </button>
      {isOpen && (
        <div className="vt-token-picker-popover">
          <input
            ref={inputRef}
            className="vt-token-picker-search"
            type="text"
            placeholder={`ابحث عن المفردة لـ ${tokenText}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
              }
            }}
          />
          <div className="vt-token-picker-results">
            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry) => {
                const isSelected = entry.id === currentConceptId;
                const subtitle = entry.aliases.slice(0, 2).join(" • ");
                return (
                  <button
                    key={entry.id}
                    className={`vt-token-picker-option ${
                      isSelected ? "vt-token-picker-option-selected" : ""
                    }`}
                    type="button"
                    onClick={() => {
                      onSelect(entry.id);
                      onClose();
                    }}
                  >
                    <span className="vt-token-picker-option-title">{entry.title}</span>
                    {subtitle ? (
                      <span className="vt-token-picker-option-subtitle">{subtitle}</span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="vt-token-picker-empty">لا توجد نتائج مطابقة</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function VersesTokenEditor({
  initialData,
  onSave,
}: TokenEditorProps) {
  const [verses, setVerses] = useState<Record<string, VerseData>>(
    initialData?.verses ?? {}
  );
  const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>([]);
  const [surahs, setSurahs] = useState<SurahInfo[]>([]);

  // Navigation state
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [surahSearch, setSurahSearch] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [loadingGlossary, setLoadingGlossary] = useState(false);
  const [loadingSurahs, setLoadingSurahs] = useState(false);
  const [activeConceptPickerKey, setActiveConceptPickerKey] = useState<string | null>(
    null
  );

  // Refs for scroll management
  const verseListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (glossaryEntries.length > 0 || loadingGlossary) return;
    setLoadingGlossary(true);
    fetch("/api/content/glossary")
      .then((res) => res.json())
      .then((data) => {
        if (data?.item?.document?.entries) {
          const entries = Object.values(data.item.document.entries) as GlossaryEntry[];
          setGlossaryEntries(entries);
        }
      })
      .catch((err) => console.error("Failed to load glossary:", err))
      .finally(() => setLoadingGlossary(false));
  }, [glossaryEntries.length, loadingGlossary]);

  useEffect(() => {
    if (surahs.length > 0 || loadingSurahs) return;
    setLoadingSurahs(true);
    fetch("/api/content/surahs")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data?.item?.document)) {
          return;
        }

        const entries = data.item.document
          .map((entry: { id?: string; nameAr?: string; ayahCount?: number }) => {
            if (
              typeof entry.id !== "string" ||
              typeof entry.nameAr !== "string" ||
              typeof entry.ayahCount !== "number"
            ) {
              return null;
            }

            return {
              id: parseInt(entry.id, 10),
              nameAr: entry.nameAr,
              ayahCount: entry.ayahCount,
            };
          })
          .filter((entry: SurahInfo | null): entry is SurahInfo => entry !== null);

        setSurahs(entries);
      })
      .catch((err) => console.error("Failed to load surahs:", err))
      .finally(() => setLoadingSurahs(false));
  }, [loadingSurahs, surahs.length]);

  // Auto-select first surah on mount
  useEffect(() => {
    if (selectedSurahId === null && surahs.length > 0) {
      setSelectedSurahId(surahs[0].id);
    }
  }, [selectedSurahId, surahs]);

  useEffect(() => {
    setActiveConceptPickerKey(null);
  }, [selectedSurahId, selectedVerseId]);

  useEffect(() => {
    if (!activeConceptPickerKey) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const wrapper = event.target.closest("[data-vt-picker-key]");
      const wrapperKey = wrapper?.getAttribute("data-vt-picker-key");
      if (wrapperKey !== activeConceptPickerKey) {
        setActiveConceptPickerKey(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activeConceptPickerKey]);

  const selectedVerse = selectedVerseId ? verses[selectedVerseId] : null;

  // Surah stats
  const surahStats = useMemo(() => {
    const stats = new Map<number, { total: number; redTokens: number }>();
    surahs.forEach((s) => stats.set(s.id, { total: 0, redTokens: 0 }));
    Object.values(verses).forEach((v) => {
      const entry = stats.get(v.surah);
      if (entry) {
        entry.total++;
        entry.redTokens += v.tokens.filter((t) => t.style === "red").length;
      }
    });
    return stats;
  }, [surahs, verses]);

  // Total stats
  const totalRedTokens = useMemo(() => {
    let count = 0;
    Object.values(verses).forEach((v) => {
      v.tokens.forEach((t) => {
        if (t.style === "red") count++;
      });
    });
    return count;
  }, [verses]);

  // Filtered surahs
  const filteredSurahs = useMemo(() => {
    const q = surahSearch.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter((s) => {
      return (
        s.nameAr.includes(q) ||
        s.id.toString().includes(q) ||
        s.ayahCount.toString().includes(q)
      );
    });
  }, [surahSearch, surahs]);

  // Verses for selected surah
  const surahVerses = useMemo(() => {
    if (selectedSurahId === null) return [];
    const all = Object.values(verses)
      .filter((v) => v.surah === selectedSurahId)
      .sort((a, b) => a.ayah - b.ayah);

    const q = searchQuery.trim().toLowerCase();
    if (!q) return all;

    return all.filter((v) => {
      const text = v.text.toLowerCase();
      const tokens = v.tokens.map((t) => t.t.toLowerCase()).join(" ");
      const key = `${v.surah}:${v.ayah}`;
      return (
        text.includes(q) ||
        tokens.includes(q) ||
        key.includes(q) ||
        v.ayah.toString().includes(q)
      );
    });
  }, [verses, selectedSurahId, searchQuery]);

  const handleTokenToggle = useCallback(
    (verseId: string, tokenIndex: number) => {
      setVerses((prev) => {
        const verse = prev[verseId];
        if (!verse) return prev;

        const newTokens = [...verse.tokens];
        const token = { ...newTokens[tokenIndex] };

        if (token.style === "red") {
          delete token.style;
          delete token.conceptId;
          delete token.paragraphId;
        } else {
          token.style = "red";
          if (glossaryEntries.length > 0) {
            token.conceptId = glossaryEntries[0].id;
            token.paragraphId = glossaryEntries[0].defaultParagraphId;
          }
        }

        newTokens[tokenIndex] = token;
        return { ...prev, [verseId]: { ...verse, tokens: newTokens } };
      });
    },
    [glossaryEntries]
  );

  const handleTokenConceptChange = useCallback(
    (verseId: string, tokenIndex: number, conceptId: string) => {
      setVerses((prev) => {
        const verse = prev[verseId];
        if (!verse) return prev;

        const newTokens = [...verse.tokens];
        const token = { ...newTokens[tokenIndex] };
        token.conceptId = conceptId;

        const entry = glossaryEntries.find((e) => e.id === conceptId);
        if (entry?.defaultParagraphId) {
          token.paragraphId = entry.defaultParagraphId;
        }

        newTokens[tokenIndex] = token;
        return { ...prev, [verseId]: { ...verse, tokens: newTokens } };
      });
    },
    [glossaryEntries]
  );

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onSave({ version: 1, verses });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const selectedSurahInfo = surahs.find((s) => s.id === selectedSurahId) ?? null;
  const selectedSurahStat = selectedSurahId ? surahStats.get(selectedSurahId) : null;

  return (
    <div className="vt-editor-shell">
      {/* Top bar */}
      <div className="vt-top-bar">
        <div className="vt-stats">
          <div className="vt-stat">
            <span className="vt-stat-value">{Object.keys(verses).length.toLocaleString("ar-EG")}</span>
            <span className="vt-stat-label">آية</span>
          </div>
          <div className="vt-stat">
            <span className="vt-stat-value vt-stat-red">{totalRedTokens.toLocaleString("ar-EG")}</span>
            <span className="vt-stat-label">كلمة مميزة</span>
          </div>
          <div className="vt-stat">
            <span className="vt-stat-value">{loadingGlossary ? "..." : glossaryEntries.length.toLocaleString("ar-EG")}</span>
            <span className="vt-stat-label">مفردة</span>
          </div>
        </div>
        <div className="vt-actions">
          <button
            className="vt-btn vt-btn-ghost"
            type="button"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? "إخفاء المعاينة" : "عرض المعاينة"}
          </button>
          <button
            className={`vt-btn vt-btn-primary ${saved ? "vt-btn-success" : ""}`}
            type="button"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "جاري الحفظ..." : saved ? "✓ تم الحفظ" : "حفظ"}
          </button>
        </div>
      </div>

      {/* 3-pane layout */}
      <div className="vt-layout">
        {/* Pane 1: Surah list */}
        <div className="vt-pane vt-pane-surahs">
          <div className="vt-pane-header">
            <strong>السور</strong>
            <span className="vt-pane-count">{filteredSurahs.length}</span>
          </div>
          <input
            className="vt-search-input"
            type="text"
            placeholder="ابحث عن سورة..."
            value={surahSearch}
            onChange={(e) => setSurahSearch(e.target.value)}
          />
          <div className="vt-surah-list">
            {filteredSurahs.map((surah) => {
              const stat = surahStats.get(surah.id);
              const isSelected = selectedSurahId === surah.id;
              return (
                <button
                  key={surah.id}
                  className={`vt-surah-item ${isSelected ? "vt-surah-item-selected" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectedSurahId(surah.id);
                    setSelectedVerseId(null);
                    setSearchQuery("");
                  }}
                >
                  <div className="vt-surah-item-top">
                    <span className="vt-surah-num">{surah.id}</span>
                    <span className="vt-surah-name">{surah.nameAr}</span>
                    <span className="vt-surah-ayahs">{surah.ayahCount} آية</span>
                  </div>
                  {stat && stat.redTokens > 0 && (
                    <span className="vt-surah-red-badge">{stat.redTokens} مميزة</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pane 2: Verse list */}
        <div className="vt-pane vt-pane-verses">
          <div className="vt-pane-header">
            <strong>{selectedSurahInfo ? `سورة ${selectedSurahInfo.nameAr}` : "اختر سورة"}</strong>
            {selectedSurahStat && (
              <span className="vt-pane-count">
                {selectedSurahStat.total} آية · {selectedSurahStat.redTokens} مميزة
              </span>
            )}
          </div>
          {selectedSurahId !== null && (
            <input
              className="vt-search-input"
              type="text"
              placeholder="ابحث في السورة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          )}
          <div className="vt-verse-list" ref={verseListRef}>
            {selectedSurahId === null ? (
              <div className="vt-empty">اختر سورة من القائمة</div>
            ) : surahVerses.length === 0 ? (
              <div className="vt-empty">لا توجد آيات</div>
            ) : (
              surahVerses.map((verse) => {
                const verseId = verse.id;
                const redCount = verse.tokens.filter((t) => t.style === "red").length;
                const isSelected = selectedVerseId === verseId;
                return (
                  <button
                    key={verseId}
                    className={`vt-verse-item ${isSelected ? "vt-verse-item-selected" : ""}`}
                    type="button"
                    onClick={() => setSelectedVerseId(verseId)}
                  >
                    <div className="vt-verse-item-top">
                      <span className="vt-verse-num">{verse.ayah}</span>
                      <span className="vt-verse-text">{verse.text}</span>
                    </div>
                    {redCount > 0 && (
                      <span className="vt-verse-red-badge">{redCount}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Pane 3: Token editor */}
        <div className="vt-pane vt-pane-editor">
          {selectedVerse ? (
            <>
              <div className="vt-editor-header">
                <div>
                  <h3 className="vt-editor-title">
                    الآية {selectedVerse.ayah} — سورة {selectedSurahInfo?.nameAr}
                  </h3>
                  <p className="vt-editor-hint">
                    اضغط على أي كلمة لتمييزها باللون الأحمر وربطها بمفردة
                  </p>
                </div>
              </div>

              {/* Tokens */}
              <div className="vt-tokens">
                {selectedVerse.tokens.map((token, index) => {
                  const isRed = token.style === "red";
                  const pickerKey = `${selectedVerse.id}:${index}`;

                  return (
                    <div
                      key={index}
                      className="vt-token-wrapper"
                      data-vt-picker-key={pickerKey}
                    >
                      <button
                        className={`vt-token-btn ${isRed ? "vt-token-btn-red" : ""}`}
                        type="button"
                        onClick={() => handleTokenToggle(selectedVerse.id, index)}
                        title={isRed ? "اضغط لإزالة التمييز" : "اضغط لتمييز هذه الكلمة"}
                      >
                        {token.t}
                      </button>
                      {isRed && (
                        <TokenConceptPicker
                          tokenText={token.t}
                          currentConceptId={token.conceptId}
                          entries={glossaryEntries}
                          isOpen={activeConceptPickerKey === pickerKey}
                          onOpen={() => setActiveConceptPickerKey(pickerKey)}
                          onClose={() => setActiveConceptPickerKey(null)}
                          onSelect={(conceptId) =>
                            handleTokenConceptChange(selectedVerse.id, index, conceptId)
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="vt-preview">
                  <h4 className="vt-preview-title">معاينة</h4>
                  <div className="vt-preview-text">
                    {selectedVerse.tokens.map((token, index) => {
                      const isRed = token.style === "red";
                      return (
                        <span
                          key={index}
                          className={`vt-preview-token ${isRed ? "vt-preview-token-red" : ""}`}
                        >
                          {token.t}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="vt-summary">
                <h4 className="vt-summary-title">الكلمات المميزة في هذه الآية</h4>
                {selectedVerse.tokens
                  .filter((t) => t.style === "red")
                  .map((token, index) => {
                    const concept = glossaryEntries.find(
                      (e) => e.id === token.conceptId
                    );
                    return (
                      <div key={index} className="vt-summary-item">
                        <span className="vt-summary-word">{token.t}</span>
                        <span className="vt-summary-arrow">←</span>
                        <span className="vt-summary-concept">
                          {concept?.title ?? "غير مرتبط"}
                        </span>
                      </div>
                    );
                  })}
                {selectedVerse.tokens.filter((t) => t.style === "red").length === 0 && (
                  <p className="vt-summary-empty">
                    لا توجد كلمات مميزة. اضغط على أي كلمة أعلاه لبدء التمييز.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="vt-empty-editor">
              <p>اختر آية من القائمة لتعديل الكلمات المميزة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
