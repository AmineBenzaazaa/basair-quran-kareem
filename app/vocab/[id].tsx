import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CardButton,
  EmptyState,
  IconButton,
  ScreenContainer,
  ScreenHeader,
  SectionTitle,
} from "../../src/components";
import { useContentData } from "../../src/content";
import { colors, spacing } from "../../src/theme";
import { rtlFlexDir } from "../../src/utils/rtl";
import { useAppStore } from "../../src/store/useStore";

const PREVIEW_LIMIT = 180;

export default function VocabularyDetailScreen() {
  const router = useRouter();
  const content = useContentData();
  const { width } = useWindowDimensions();
  // Stack cards vertically on small screens so text never gets squeezed.
  const stackCards = width < 360;
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const entry = content.getVocabularyById(id);

  const isBookmarked = useAppStore((state) => state.isBookmarked("vocab", id));
  const toggleBookmark = useAppStore((state) => state.toggleBookmark);

  if (!entry) {
    return (
      <ScreenContainer style={styles.container}>
        <EmptyState title="لم يتم العثور على المفردة" />
      </ScreenContainer>
    );
  }

  const preview =
    entry.explanation && entry.explanation.length > PREVIEW_LIMIT
      ? `${entry.explanation.slice(0, PREVIEW_LIMIT)}…`
      : entry.explanation ?? "لا يوجد شرح مكتوب بعد.";

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title={entry.phrase}
        fallbackHref="/vocab"
        rightSlot={
          <IconButton
            name={isBookmarked ? "favorite" : "favorite-border"}
            onPress={() =>
              toggleBookmark({
                type: "vocab",
                id: entry.id,
                meta: { phrase: entry.phrase },
              })
            }
          />
        }
      />


      <SectionTitle title="اختر المسار" subtitle="القراءة أو المشاهدة" />
      <View style={[styles.actionsGrid, stackCards && styles.actionsGridColumn]}>
        <View style={styles.actionCol}>
          <CardButton
            title="القراءة"
            subtitle="شرح المفردة بالتفصيل"
            iconName="article"
            onPress={() => router.push(`/vocab/${entry.id}/read`)}
          />
        </View>
        <View style={styles.actionCol}>
          <CardButton
            title="المشاهدة"
            subtitle={`${entry.videoUrls.length} فيديو`}
            iconName="play-circle-outline"
            onPress={() => router.push(`/vocab/${entry.id}/videos`)}
          />
        </View>
      </View>
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
  actionsGrid: {
    flexDirection: rtlFlexDir,
    gap: spacing.md,
  },
  actionsGridColumn: {
    flexDirection: "column",
  },
  actionCol: {
    flex: 1,
  },
});
