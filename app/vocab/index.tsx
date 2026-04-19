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
import { includesNormalized } from "../../src/utils/arabic";

export default function VocabularyListScreen() {
  const router = useRouter();
  const content = useContentData();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    if (!deferredQuery.trim()) return content.vocabularyEntries;
    return content.vocabularyEntries.filter((entry) => {
      const variants = entry.variants?.join(" ") ?? "";
      const keywords = entry.keywords?.join(" ") ?? "";
      return (
        includesNormalized(entry.phrase, deferredQuery) ||
        includesNormalized(variants, deferredQuery) ||
        includesNormalized(keywords, deferredQuery) ||
        (entry.explanation
          ? includesNormalized(entry.explanation, deferredQuery)
          : false)
      );
    });
  }, [deferredQuery, content]);

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title="فهرس المفردات"
        subtitle="مصطلحات محورية"
        fallbackHref="/menu"
      />
      <SearchBar value={query} onChangeText={setQuery} placeholder="ابحث في المفردات" />
      <View style={styles.list}>
        {filtered.length === 0 ? (
          <EmptyState title="لا توجد نتائج" subtitle="جرّب كلمة أخرى" />
        ) : (
          filtered.map((entry) => (
            <CardButton
              key={entry.id}
              title={entry.phrase}
              iconName="menu-book"
              onPress={() => router.push(`/vocab/${entry.id}`)}
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
