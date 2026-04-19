import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArabicParagraph,
  CardButton,
  EmptyState,
  ScreenContainer,
  ScreenHeader,
  SectionTitle,
} from "../../../src/components";
import { useContentData } from "../../../src/content";
import { colors, spacing } from "../../../src/theme";

export default function VocabularyReadScreen() {
  const router = useRouter();
  const content = useContentData();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const entry = content.getVocabularyById(id);

  if (!entry) {
    return (
      <ScreenContainer style={styles.container}>
        <EmptyState title="لم يتم العثور على المفردة" />
      </ScreenContainer>
    );
  }

  const paragraphs = content.getVocabularyExplanationParagraphsById(id);

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title={`قراءة · ${entry.phrase}`}
        fallbackHref={`/vocab/${id}`}
      />

      <View style={styles.card}>
        

        <View style={styles.paragraphs}>
          {paragraphs.length ? (
            paragraphs.map((paragraph, index) => (
              <ArabicParagraph key={`${entry.id}:${index}`}>{paragraph}</ArabicParagraph>
            ))
          ) : (
            <ArabicParagraph>لا يوجد شرح مكتوب بعد.</ArabicParagraph>
          )}
        </View>
      </View>

      <CardButton
        title="الانتقال إلى المشاهدة"
        subtitle={`${entry.videoUrls.length} فيديو`}
        iconName="play-circle-outline"
        onPress={() => router.push(`/vocab/${entry.id}/videos`)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  paragraphs: {
    gap: spacing.md,
  },
});
