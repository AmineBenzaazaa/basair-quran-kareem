import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  ArabicParagraph,
  EmptyState,
  ScreenContainer,
  ScreenHeader,
  SearchBar,
  SectionTitle,
} from "../../src/components";
import { useContentData } from "../../src/content";
import { colors, spacing, typography } from "../../src/theme";
import { rtlTextAlign } from "../../src/utils/rtl";
import { includesNormalized } from "../../src/utils/arabic";

type ConceptsDocument = {
  title?: string;
  sections?: {
    heading?: string | null;
    paragraphs?: string[];
  }[];
};

type ConceptsBlock = {
  heading: string | null;
  paragraphs: string[];
};

const isConceptHeadingCandidate = (line: string, nextLine?: string) => {
  const value = line.trim();
  const nextValue = nextLine?.trim() ?? "";

  if (!value) return false;
  if (value.length > 55) return false;
  if (/^[\[{(]/.test(value)) return false;
  if (/^[0-9٠-٩]/.test(value)) return false;
  if (/[.!؟؛:]$/.test(value)) return false;
  if (nextValue.length < 40) return false;

  return true;
};

const normalizeConceptsBlocks = (document: ConceptsDocument): ConceptsBlock[] => {
  const blocks = (document.sections ?? [])
    .map((section) => ({
      heading:
        typeof section.heading === "string" && section.heading.trim()
          ? section.heading.trim()
          : null,
      paragraphs: (section.paragraphs ?? [])
        .map((line) => line.trim())
        .filter(Boolean),
    }))
    .filter((section) => section.heading || section.paragraphs.length > 0);

  if (blocks.some((block) => block.heading)) {
    return blocks;
  }

  const flattenedLines = blocks.flatMap((block) => block.paragraphs);
  const expandedBlocks: ConceptsBlock[] = [];
  let currentBlock: ConceptsBlock | null = null;

  for (let index = 0; index < flattenedLines.length; index += 1) {
    const line = flattenedLines[index];

    if (isConceptHeadingCandidate(line, flattenedLines[index + 1])) {
      if (currentBlock && (currentBlock.heading || currentBlock.paragraphs.length)) {
        expandedBlocks.push(currentBlock);
      }
      currentBlock = {
        heading: line,
        paragraphs: [],
      };
      continue;
    }

    if (!currentBlock) {
      currentBlock = {
        heading: null,
        paragraphs: [],
      };
    }

    currentBlock.paragraphs.push(line);
  }

  if (currentBlock && (currentBlock.heading || currentBlock.paragraphs.length)) {
    expandedBlocks.push(currentBlock);
  }

  return expandedBlocks.length ? expandedBlocks : blocks;
};

export default function ConceptsScreen() {
  const content = useContentData();
  const [query, setQuery] = useState("");

  const article = content.documents.concepts as ConceptsDocument;
  const allBlocks = useMemo(() => normalizeConceptsBlocks(article), [article]);
  const trimmedQuery = query.trim();

  const visibleBlocks = useMemo(() => {
    if (!trimmedQuery) return allBlocks;
    return allBlocks.filter(
      (block) =>
        Boolean(block.heading) &&
        includesNormalized(block.heading ?? "", trimmedQuery)
    );
  }, [allBlocks, trimmedQuery]);

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title={article.title ?? "المعاني والدلالات"}
        fallbackHref="/menu"
      />

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="ابحث في العناوين فقط"
      />

      <SectionTitle
        title="المعاني والدلالات"
        subtitle={trimmedQuery ? `نتائج البحث: ${visibleBlocks.length}` : "المحتوى الكامل"}
      />

      {visibleBlocks.length === 0 ? (
        <EmptyState title="لا توجد نتائج" subtitle="جرّب كلمة أخرى" />
      ) : (
        visibleBlocks.map((block, blockIndex) => (
          <View key={`${block.heading ?? "block"}-${blockIndex}`} style={styles.block}>
            {block.heading ? (
              <Text
                style={[
                  styles.blockHeading,
                  trimmedQuery &&
                  includesNormalized(block.heading, trimmedQuery) &&
                  styles.highlight,
                ]}
              >
                {block.heading}
              </Text>
            ) : null}
            {block.paragraphs.map((paragraph, paragraphIndex) => (
              <ArabicParagraph key={`${blockIndex}-${paragraphIndex}`}>
                {paragraph}
              </ArabicParagraph>
            ))}
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  block: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockHeading: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    color: colors.textPrimary,
  },
  highlight: {
    backgroundColor: colors.highlight,
    borderRadius: 8,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    alignSelf: "flex-end",
  },
});
