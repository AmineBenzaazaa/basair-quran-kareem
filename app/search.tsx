import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CardButton,
  EmptyState,
  ScreenContainer,
  ScreenHeader,
  SearchBar,
  TabPill,
} from "../src/components";
import { useContentData } from "../src/content";
import { spacing } from "../src/theme";
import { rtlFlexDir } from "../src/utils/rtl";
import { includesNormalized } from "../src/utils/arabic";
import type { SearchResult } from "../src/content/types";

type Filter = "tafsir" | "vocab" | "articles";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "التفسير", value: "tafsir" },
  { label: "المفردات", value: "vocab" },
  { label: "المقالات", value: "articles" },
];

const createSnippet = (text: string, query: string) => {
  if (!query) return text;
  const index = text.indexOf(query);
  if (index === -1) return text;
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + query.length + 24);
  return text.slice(start, end);
};

export default function GlobalSearchScreen() {
  const router = useRouter();
  const content = useContentData();
  const params = useLocalSearchParams<{ seed?: string | string[] }>();
  const seed = Array.isArray(params.seed) ? params.seed[0] : params.seed ?? "";
  const [query, setQuery] = useState(seed);
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<Filter>("tafsir");

  useEffect(() => {
    if (seed) {
      setQuery(seed);
    }
  }, [seed]);

  const results = useMemo<SearchResult[]>(() => {
    const trimmed = deferredQuery.trim();
    if (!trimmed) return [];

    if (filter === "articles") {
      return content.articles
        .map((article) => {
          const matchParagraph =
            article.sections
              .flatMap((section) => section.paragraphs)
              .find((para) => includesNormalized(para, trimmed)) ?? "";
          const matchTitle = includesNormalized(article.title, trimmed);
          if (!matchParagraph && !matchTitle) return null;
          return {
            type: "article",
            id: article.id,
            title: article.title,
            snippet: matchParagraph
              ? createSnippet(matchParagraph, trimmed)
              : article.title,
          } satisfies SearchResult;
        })
        .filter(Boolean) as SearchResult[];
    }

    if (filter === "vocab") {
      return content.vocabularyEntries
        .map((entry) => {
          const variants = entry.variants?.join(" ") ?? "";
          const keywords = entry.keywords?.join(" ") ?? "";
          const match =
            includesNormalized(entry.phrase, trimmed) ||
            includesNormalized(variants, trimmed) ||
            includesNormalized(keywords, trimmed) ||
            (entry.explanation
              ? includesNormalized(entry.explanation, trimmed)
              : false);
          if (!match) return null;
          return {
            type: "vocab",
            id: entry.id,
            title: entry.phrase,
            snippet: entry.explanation
              ? createSnippet(entry.explanation, trimmed)
              : variants,
          } satisfies SearchResult;
        })
        .filter(Boolean) as SearchResult[];
    }

    const map = new Map<string, SearchResult>();
    content.ayahList.forEach((ayah) => {
      if (!includesNormalized(ayah.textAr, trimmed)) return;
      const surah = content.getSurahById(ayah.surahId);
      if (!surah) return;
      map.set(`${ayah.surahId}:${ayah.ayahNumber}`, {
        type: "ayah",
        id: `${ayah.surahId}:${ayah.ayahNumber}`,
        title: `${surah.nameAr} · آية ${ayah.ayahNumber}`,
        snippet: ayah.textAr,
        surahId: ayah.surahId,
        ayahNumber: ayah.ayahNumber,
      });
    });

    content.tafsirEntries.forEach((entry) => {
      const match = entry.tafsirParagraphs.find((para) =>
        includesNormalized(para, trimmed)
      );
      if (!match) return;
      const surah = content.getSurahById(entry.surahId);
      if (!surah) return;
      map.set(`${entry.surahId}:${entry.ayahNumber}`, {
        type: "ayah",
        id: `${entry.surahId}:${entry.ayahNumber}`,
        title: `${surah.nameAr} · آية ${entry.ayahNumber}`,
        snippet: createSnippet(match, trimmed),
        surahId: entry.surahId,
        ayahNumber: entry.ayahNumber,
      });
    });

    return Array.from(map.values());
  }, [deferredQuery, filter, content]);

  const handleNavigate = (item: SearchResult) => {
    if (item.type === "article") {
      router.push(`/articles/${item.id}?highlight=${query}`);
      return;
    }
    if (item.type === "vocab") {
      router.push(`/vocab/${item.id}`);
      return;
    }
    router.push(
      `/quran/${item.surahId}/${item.ayahNumber}?highlight=${query}`
    );
  };

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader title="البحث الشامل" fallbackHref="/menu" />
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="ابحث في التفسير والمفردات والمقالات"
      />
      <View style={styles.tabs}>
        {FILTERS.map((item) => (
          <TabPill
            key={item.value}
            label={item.label}
            active={filter === item.value}
            onPress={() => setFilter(item.value)}
          />
        ))}
      </View>

      <View style={styles.results}>
        {results.length === 0 ? (
          <EmptyState
            title={query.trim() ? "لا توجد نتائج" : "ابدأ البحث"}
            subtitle={
              query.trim()
                ? "جرّب كلمة أخرى أو غيّر نوع البحث"
                : "اكتب كلمة للعثور على النتائج"
            }
          />
        ) : (
          results.map((item) => (
            <CardButton
              key={item.id}
              title={item.title}
              subtitle={item.snippet}
              iconName="search"
              onPress={() => handleNavigate(item)}
            />
          ))
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  tabs: {
    flexDirection: rtlFlexDir,
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  results: {
    gap: spacing.md,
  },
});
