import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import {
  ArabicParagraph,
  EmptyState,
  IconButton,
  ScreenContainer,
  ScreenHeader,
} from "../../../src/components";
import { useContentData } from "../../../src/content";
import { useDataContent, type GlossaryEntry, type VerseToken } from "../../../src/data";
import { colors, spacing, typography } from "../../../src/theme";
import { rtlFlexDir, rtlTextAlign } from "../../../src/utils/rtl";
import { rf } from "../../../src/utils/responsive";
import { useAppStore } from "../../../src/store/useStore";
import { includesNormalized } from "../../../src/utils/arabic";

const tokenizeAyahText = (text: string): VerseToken[] =>
  text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => ({ t: token }));


export default function TafsirReaderScreen() {
  const router = useRouter();
  const content = useContentData();
  const data = useDataContent();
  const params = useLocalSearchParams<{
    surahId?: string | string[];
    ayahNumber?: string | string[];
    ayahEnd?: string | string[];
    highlight?: string | string[];
  }>();

  const surahId = Array.isArray(params.surahId)
    ? params.surahId[0]
    : params.surahId ?? "";
  const ayahNumberValue = Array.isArray(params.ayahNumber)
    ? params.ayahNumber[0]
    : params.ayahNumber ?? "1";
  const ayahNumber = Number(ayahNumberValue);
  const highlight = Array.isArray(params.highlight)
    ? params.highlight[0]
    : params.highlight ?? "";

  const surah = content.getSurahById(surahId);
  const ayah = content.getAyah(surahId, ayahNumber);
  const tafsir = content.getTafsirEntry(surahId, ayahNumber);
  const tafsirRange = content.getTafsirRangeForAyah(surahId, ayahNumber);
  const tafsirRanges = content.getTafsirRangesBySurah(surahId);

  const rangeStartAyahNumber = tafsirRange?.startAyahNumber ?? ayahNumber;
  const rangeEndAyahNumber = tafsirRange?.endAyahNumber ?? ayahNumber;
  const ayahBlockItems = tafsirRange?.ayahs ?? (ayah ? [ayah] : []);
  const ayahBlockText = ayahBlockItems
    .map((item) => `${item.textAr} (${item.ayahNumber})`)
    .join(" ");
  const tafsirParagraphs =
    tafsirRange?.tafsirParagraphs?.length
      ? tafsirRange.tafsirParagraphs
      : (tafsir?.tafsirParagraphs ?? ["لا يوجد تفسير لهذه الآية بعد."]);

  const isBookmarked = useAppStore((state) =>
    state.isBookmarked("ayah", `${surahId}:${ayahNumber}`)
  );
  const toggleBookmark = useAppStore((state) => state.toggleBookmark);
  const setLastRead = useAppStore((state) => state.setLastRead);
  const fontSize = useAppStore((state) => state.settings.fontSize);
  const setFontSize = useAppStore((state) => state.setFontSize);

  useEffect(() => {
    if (surah && ayah) {
      setLastRead({ surahId, ayahNumber });
    }
  }, [surah, ayah, surahId, ayahNumber, setLastRead]);

  const currentRangeIndex = tafsirRanges.findIndex(
    (range) =>
      ayahNumber >= range.startAyahNumber && ayahNumber <= range.endAyahNumber
  );
  const previousRange = currentRangeIndex > 0 ? tafsirRanges[currentRangeIndex - 1] : null;
  const nextRange =
    currentRangeIndex >= 0 && currentRangeIndex < tafsirRanges.length - 1
      ? tafsirRanges[currentRangeIndex + 1]
      : null;

  const previousAyah = content.getAyah(surahId, ayahNumber - 1);
  const nextAyah = content.getAyah(surahId, ayahNumber + 1);
  const canGoPrev = Boolean(previousRange || previousAyah);
  const canGoNext = Boolean(nextRange || nextAyah);

  const headerTitle = useMemo(() => {
    if (!surah) return "التفسير";
    if (rangeStartAyahNumber === rangeEndAyahNumber) {
      return `${surah.nameAr} · آية ${rangeStartAyahNumber}`;
    }
    return `${surah.nameAr} · الآيات ${rangeStartAyahNumber} إلى ${rangeEndAyahNumber}`;
  }, [surah, rangeStartAyahNumber, rangeEndAyahNumber]);
  const linkedVocabularies = useMemo<Array<{ entry: GlossaryEntry; label: string }>>(() => {
    const seen = new Set<string>();
    const results: Array<{ entry: GlossaryEntry; label: string }> = [];
    for (const item of ayahBlockItems) {
      const verse = data.getVerse(`${item.surahId}:${item.ayahNumber}`);
      if (!verse) continue;
      for (const token of verse.tokens) {
        if (token.style === "red" && token.conceptId && !seen.has(token.conceptId)) {
          const entry = data.getGlossaryEntry(token.conceptId);
          if (entry) {
            seen.add(token.conceptId);
            results.push({ entry, label: token.t });
          }
        }
      }
    }
    return results;
  }, [ayahBlockItems, data]);

  const ayahBlockContent = useMemo<React.ReactNode>(() => {
    let hasHighlightedTokens = false;

    const renderedAyahs = ayahBlockItems.map((item, itemIndex) => {
      const verse =
        data.getVerse(`${item.surahId}:${item.ayahNumber}`) ?? null;
      const verseTokens = verse?.tokens?.length ? verse.tokens : tokenizeAyahText(item.textAr);

      return (
        <React.Fragment key={`${item.surahId}:${item.ayahNumber}`}>
          {verseTokens.flatMap((token, tokenIndex) => {
            const isHighlighted = token.style === "red";

            if (isHighlighted) {
              hasHighlightedTokens = true;
            }

            const parts: React.ReactNode[] = [];
            if (tokenIndex > 0) {
              parts.push(" ");
            }
            parts.push(
              <Text
                key={`${item.surahId}:${item.ayahNumber}:${tokenIndex}`}
                style={isHighlighted ? styles.ayahWordHighlight : undefined}
              >
                {token.t}
              </Text>
            );
            return parts;
          })}
          {` (${item.ayahNumber})`}
          {itemIndex < ayahBlockItems.length - 1 ? " " : null}
        </React.Fragment>
      );
    });

    return hasHighlightedTokens ? renderedAyahs : ayahBlockText;
  }, [ayahBlockItems, ayahBlockText, data]);

  if (!surah || !ayah) {
    return (
      <ScreenContainer style={styles.container}>
        <EmptyState title="لا توجد بيانات لهذه الآية" />
      </ScreenContainer>
    );
  }

  const adjustFontSize = (delta: number) => {
    const next = Math.min(28, Math.max(14, fontSize + delta));
    setFontSize(next);
  };

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title={headerTitle}
        fallbackHref={`/quran/${surahId}`}
        rightSlot={
          <IconButton
            name={isBookmarked ? "bookmark" : "bookmark-border"}
            onPress={() =>
              toggleBookmark({
                type: "ayah",
                id: `${surahId}:${ayahNumber}`,
                meta: { surahName: surah.nameAr, ayahNumber },
              })
            }
          />
        }
      />

      <View style={styles.ayahCard}>
        <ArabicParagraph style={styles.ayahText}>{ayahBlockContent}</ArabicParagraph>
      </View>

      <View style={styles.controls}>
        <IconButton name="remove" onPress={() => adjustFontSize(-2)} />
        <IconButton name="add" onPress={() => adjustFontSize(2)} />
        <View style={{ flex: 1 }} />
        <IconButton
          name="chevron-right"
          disabled={!canGoPrev}
          onPress={() => {
            if (previousRange) {
              router.push(
                `/quran/${surahId}/${previousRange.startAyahNumber}?ayahEnd=${previousRange.endAyahNumber}`
              );
              return;
            }
            if (previousAyah) {
              router.push(`/quran/${surahId}/${previousAyah.ayahNumber}`);
            }
          }}
          color={canGoPrev ? colors.textPrimary : colors.muted}
        />
        <IconButton
          name="chevron-left"
          disabled={!canGoNext}
          onPress={() => {
            if (nextRange) {
              router.push(
                `/quran/${surahId}/${nextRange.startAyahNumber}?ayahEnd=${nextRange.endAyahNumber}`
              );
              return;
            }
            if (nextAyah) {
              router.push(`/quran/${surahId}/${nextAyah.ayahNumber}`);
            }
          }}
          color={canGoNext ? colors.textPrimary : colors.muted}
        />
      </View>

      <View style={styles.tafsirCard}>
        {tafsirParagraphs.map((para, index) => (
          <ArabicParagraph
            key={`${surahId}-${rangeStartAyahNumber}-${rangeEndAyahNumber}-${index}`}
            highlight={highlight ? includesNormalized(para, highlight) : false}
          >
            {para}
          </ArabicParagraph>
        ))}
        {linkedVocabularies.map(({ entry, label }) => (
          <Pressable
            key={entry.id}
            style={({ pressed }) => [
              styles.vocabTag,
              pressed && styles.vocabTagPressed,
            ]}
            onPress={() => router.push(`/vocab/${entry.id}`)}
          >
            <MaterialIcons name="bookmark" size={16} color={colors.primary} />
            <Text style={styles.vocabTagWord}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  ayahCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ayahText: {
    fontSize: rf(22, 16),
    lineHeight: rf(38, 27),
  },
  ayahWordHighlight: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
  },
  controls: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    gap: spacing.sm,
  },
  tafsirCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  vocabTag: {
    alignSelf: "flex-end",
    flexDirection: rtlFlexDir,
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(246, 48, 73, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(246, 48, 73, 0.35)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  vocabTagPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  vocabTagText: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  vocabTagWord: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: colors.primary,
  },
});
