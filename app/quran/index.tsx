import React, { useDeferredValue, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CardButton,
  EmptyState,
  ScreenContainer,
  ScreenHeader,
  SearchBar,
} from "../../src/components";
import { useContentData } from "../../src/content";
import { spacing } from "../../src/theme";
import { includesNormalized, normalizeArabic } from "../../src/utils/arabic";

const MAX_AYAH_RESULTS = 40;
const SEARCH_STOP_WORDS = new Set([
  "ابحث",
  "عن",
  "سوره",
  "سور",
  "ايه",
  "ايات",
  "الايه",
  "الايات",
]);

type SurahSearchResult = {
  type: "surah";
  id: string;
  title: string;
  subtitle: string;
  iconName: "menu-book";
  route: `/quran/${string}`;
};

type AyahSearchResult = {
  type: "ayah";
  id: string;
  title: string;
  subtitle: string;
  iconName: "format-quote";
  route: `/quran/${string}/${number}`;
  surahId: string;
  ayahNumber: number;
};

type QuranSearchResult = SurahSearchResult | AyahSearchResult;

const toWesternDigits = (value: string) =>
  value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

const extractNumbers = (value: string) =>
  (toWesternDigits(value).match(/\d+/g) ?? [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);

const extractSurahHint = (value: string) => {
  const normalized = normalizeArabic(toWesternDigits(value))
    .replace(/[^\u0600-\u06FF0-9a-zA-Z\s]/g, " ")
    .trim();

  if (!normalized) return "";

  return normalized
    .split(/\s+/)
    .filter((part) => part && !SEARCH_STOP_WORDS.has(part) && !/^\d+$/.test(part))
    .join(" ");
};

export default function QuranSurahListScreen() {
  const router = useRouter();
  const content = useContentData();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const results = useMemo<QuranSearchResult[]>(() => {
    const trimmed = deferredQuery.trim();
    if (!trimmed) {
      return content.surahList.map((surah) => ({
        type: "surah",
        id: surah.id,
        title: surah.nameAr,
        subtitle: `عدد الآيات: ${surah.ayahCount}`,
        iconName: "menu-book",
        route: `/quran/${surah.id}`,
      }));
    }

    const normalizedQuery = normalizeArabic(toWesternDigits(trimmed));
    const numbers = extractNumbers(trimmed);
    const surahHint = extractSurahHint(trimmed);
    const hasSurahKeyword = normalizedQuery.includes("سوره");

    const surahResults: SurahSearchResult[] = content.surahList
      .filter((surah) => {
        const byName = includesNormalized(surah.nameAr, trimmed);
        const byHint =
          surahHint.length > 0 && includesNormalized(surah.nameAr, surahHint);
        const byNumericSurahId =
          hasSurahKeyword && numbers.some((value) => String(value) === surah.id);
        return byName || byHint || byNumericSurahId;
      })
      .map((surah) => ({
        type: "surah",
        id: surah.id,
        title: surah.nameAr,
        subtitle: `عدد الآيات: ${surah.ayahCount}`,
        iconName: "menu-book",
        route: `/quran/${surah.id}`,
      }));

    const ayahMap = new Map<string, AyahSearchResult>();
    const pushAyahResult = (surahId: string, ayahNumber: number) => {
      const ayah = content.getAyah(surahId, ayahNumber);
      const surah = content.getSurahById(surahId);
      if (!ayah || !surah) return;
      const id = `${surahId}:${ayahNumber}`;
      if (ayahMap.has(id)) return;
      ayahMap.set(id, {
        type: "ayah",
        id,
        title: `${surah.nameAr} · آية ${ayah.ayahNumber}`,
        subtitle: ayah.textAr,
        iconName: "format-quote",
        route: `/quran/${surahId}/${ayah.ayahNumber}`,
        surahId,
        ayahNumber: ayah.ayahNumber,
      });
    };

    content.ayahList.forEach((ayah) => {
      if (!includesNormalized(ayah.textAr, trimmed)) return;
      pushAyahResult(ayah.surahId, ayah.ayahNumber);
    });

    if (numbers.length >= 2) {
      const [surahIdNumber, ayahNumber] = numbers;
      pushAyahResult(String(surahIdNumber), ayahNumber);
    }

    if (numbers.length >= 1 && surahHint) {
      const ayahNumber = numbers[numbers.length - 1];
      content.surahList.forEach((surah) => {
        if (!includesNormalized(surah.nameAr, surahHint)) return;
        pushAyahResult(surah.id, ayahNumber);
      });
    }

    const ayahResults = Array.from(ayahMap.values())
      .sort((a, b) => {
        const surahDiff = Number(a.surahId) - Number(b.surahId);
        if (surahDiff !== 0) return surahDiff;
        return a.ayahNumber - b.ayahNumber;
      })
      .slice(0, MAX_AYAH_RESULTS);

    return [...surahResults, ...ayahResults];
  }, [deferredQuery, content]);

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title="التفسير حسب السورة"
        subtitle="اختر السورة لعرض التفسير"
        fallbackHref="/menu"
      />
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="ابحث عن سورة أو آية"
      />

      <View style={styles.list}>
        {results.length === 0 ? (
          <EmptyState title="لا توجد نتائج" />
        ) : (
          results.map((item) => (
            <CardButton
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              iconName={item.iconName}
              onPress={() => router.push(item.route)}
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
  list: {
    gap: spacing.md,
  },
});
