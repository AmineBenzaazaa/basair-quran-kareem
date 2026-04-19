import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CardButton,
  EmptyState,
  ScreenContainer,
  ScreenHeader,
  SectionTitle,
} from "../../src/components";
import { useContentData } from "../../src/content";
import { colors, spacing, typography } from "../../src/theme";

export default function QuranAyahListScreen() {
  const router = useRouter();
  const content = useContentData();
  const params = useLocalSearchParams<{ surahId?: string | string[] }>();
  const surahId = Array.isArray(params.surahId)
    ? params.surahId[0]
    : params.surahId ?? "";
  const surah = content.getSurahById(surahId);
  const ranges = content.getTafsirRangesBySurah(surahId);

  if (!surah) {
    return (
      <ScreenContainer style={styles.container}>
        <EmptyState title="السورة غير متاحة" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader title={surah.nameAr} fallbackHref="/quran" />

      <SectionTitle title="الآيات" subtitle="اختر المقطع لقراءة التفسير" />

      <View style={styles.list}>
        {ranges.length === 0 ? (
          <EmptyState title="لا توجد مقاطع حالياً" />
        ) : (
          ranges.map((range) => (
            <CardButton
              key={`${range.surahId}-${range.startAyahNumber}-${range.endAyahNumber}`}
              title={
                range.startAyahNumber === range.endAyahNumber
                  ? `آية ${range.startAyahNumber}`
                  : `الآيات ${range.startAyahNumber} إلى ${range.endAyahNumber}`
              }
              subtitle={range.ayahs
                .map((ayah) => `${ayah.textAr} (${ayah.ayahNumber})`)
                .join(" ")}
              iconName="chevron-left"
              onPress={() =>
                router.push(
                  `/quran/${surahId}/${range.startAyahNumber}?ayahEnd=${range.endAyahNumber}`
                )
              }
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
