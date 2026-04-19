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
} from "../../../src/components";
import { useContentData } from "../../../src/content";
import { useAppStore } from "../../../src/store/useStore";
import { colors, spacing } from "../../../src/theme";
import { includesNormalized } from "../../../src/utils/arabic";

export default function RuleDetailScreen() {
  const content = useContentData();
  const params = useLocalSearchParams<{
    ruleNumber?: string | string[];
    highlight?: string | string[];
  }>();

  const ruleNumberValue = Array.isArray(params.ruleNumber)
    ? params.ruleNumber[0]
    : params.ruleNumber ?? "1";
  const ruleNumber = Number(ruleNumberValue);
  const highlight = Array.isArray(params.highlight)
    ? params.highlight[0]
    : params.highlight ?? "";

  const rule = content.getRuleGuideEntryByNumber(ruleNumber);
  const bookmarkId = `rules:${ruleNumber}`;
  const isBookmarked = useAppStore((state) =>
    state.isBookmarked("article", bookmarkId)
  );
  const toggleBookmark = useAppStore((state) => state.toggleBookmark);

  if (!rule) {
    return (
      <ScreenContainer style={styles.container}>
        <EmptyState title="لم يتم العثور على القاعدة" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title={`القاعدة ${rule.ruleNumber}`}
        fallbackHref="/articles/rules"
        rightSlot={
          <IconButton
            name={isBookmarked ? "bookmark" : "bookmark-border"}
            onPress={() =>
              toggleBookmark({
                type: "article",
                id: bookmarkId,
                meta: { title: rule.title },
              })
            }
          />
        }
      />

      <View style={styles.section}>
        <SectionTitle title={rule.title} />
        {rule.paragraphs.map((paragraph, index) => (
          <ArabicParagraph
            key={`${rule.id}-${index}`}
            highlight={highlight ? includesNormalized(paragraph, highlight) : false}
          >
            {paragraph}
          </ArabicParagraph>
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
  section: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
