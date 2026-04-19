import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CardButton,
  EmptyState,
  ScreenContainer,
  ScreenHeader,
  SectionTitle,
} from "../src/components";
import { useContentData } from "../src/content";
import { useAppStore } from "../src/store/useStore";
import { colors, spacing } from "../src/theme";

export default function BookmarksScreen() {
  const router = useRouter();
  const content = useContentData();
  const bookmarks = useAppStore((state) => state.bookmarks);

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader title="المفضلة" fallbackHref="/menu" />

      <SectionTitle title="محفوظاتك" subtitle="مقالات، مفردات، آيات" />

      <View style={styles.list}>
        {bookmarks.length === 0 ? (
          <EmptyState title="لا توجد عناصر محفوظة" />
        ) : (
          bookmarks.map((bookmark) => {
            if (bookmark.type === "article") {
              const article = content.getArticleById(bookmark.id);
              return (
                <CardButton
                  key={`${bookmark.type}-${bookmark.id}`}
                  title={article?.title ?? "مقال"}
                  subtitle="مقال محفوظ"
                  iconName="bookmark"
                  onPress={() => router.push(`/articles/${bookmark.id}`)}
                />
              );
            }
            if (bookmark.type === "vocab") {
              const entry = content.getVocabularyById(bookmark.id);
              return (
                <CardButton
                  key={`${bookmark.type}-${bookmark.id}`}
                  title={entry?.phrase ?? "مفردة"}
                  subtitle="مفردة محفوظة"
                  iconName="favorite"
                  onPress={() => router.push(`/vocab/${bookmark.id}`)}
                />
              );
            }
            const [surahId, ayahNumber] = bookmark.id.split(":");
            const surah = content.getSurahById(surahId);
            return (
              <CardButton
                key={`${bookmark.type}-${bookmark.id}`}
                title={`${surah?.nameAr ?? "سورة"} · آية ${ayahNumber}`}
                subtitle="آية محفوظة"
                iconName="menu-book"
                onPress={() => router.push(`/quran/${surahId}/${ayahNumber}`)}
              />
            );
          })
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
