import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  ArabicParagraph,
  EmptyState,
  IconButton,
  ScreenContainer,
  ScreenHeader,
  SectionTitle,
} from "../../src/components";
import { useContentData } from "../../src/content";
import { colors, spacing } from "../../src/theme";
import { useAppStore } from "../../src/store/useStore";
import { includesNormalized } from "../../src/utils/arabic";

export default function ArticleScreen() {
  const content = useContentData();
  const params = useLocalSearchParams<{ slug?: string | string[]; highlight?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug ?? "";
  const highlight = Array.isArray(params.highlight)
    ? params.highlight[0]
    : params.highlight ?? "";
  const article = content.getArticleById(slug);

  const isBookmarked = useAppStore((state) =>
    state.isBookmarked("article", slug)
  );
  const toggleBookmark = useAppStore((state) => state.toggleBookmark);

  if (!article) {
    return (
      <ScreenContainer style={styles.container}>
        <EmptyState title="لم يتم العثور على المحتوى" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title={article.title}
        fallbackHref="/menu"
        rightSlot={
          <IconButton
            name={isBookmarked ? "bookmark" : "bookmark-border"}
            onPress={() =>
              toggleBookmark({
                type: "article",
                id: slug,
                meta: { title: article.title },
              })
            }
          />
        }
      />

      {article.sections.map((section, index) => (
        <View key={`${article.id}-${index}`} style={styles.section}>
          {section.heading ? (
            <SectionTitle title={section.heading} />
          ) : null}
          {section.paragraphs.map((para, paraIndex) => (
            <ArabicParagraph
              key={`${article.id}-${index}-${paraIndex}`}
              highlight={highlight ? includesNormalized(para, highlight) : false}
            >
              {para}
            </ArabicParagraph>
          ))}
        </View>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
