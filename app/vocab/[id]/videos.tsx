import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CardButton,
  EmptyState,
  ScreenContainer,
  ScreenHeader,
  SectionTitle,
} from "../../../src/components";
import { useContentData } from "../../../src/content";
import { colors, spacing } from "../../../src/theme";

const extractHost = (url: string) => {
  const withoutProtocol = url.replace(/^https?:\/\//i, "");
  const host = withoutProtocol.split("/")[0]?.replace(/^www\./, "");
  return host || "رابط خارجي";
};

export default function VideoListScreen() {
  const router = useRouter();
  const content = useContentData();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const entry = content.getVocabularyById(id);

  if (!entry) {
    return (
      <ScreenContainer style={styles.container}>
        <EmptyState title="لا توجد فيديوهات" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title={`المشاهدة · ${entry.phrase}`}
        fallbackHref={`/vocab/${id}`}
      />

      <SectionTitle
        title="قائمة الفيديوهات"
        subtitle="اختر فيديو لفتح شاشة المشاهدة"
      />

      <View style={styles.list}>
        {entry.videoUrls.length === 0 ? (
          <EmptyState title="لا توجد روابط حتى الآن" />
        ) : (
          entry.videoUrls.map((url, index) => (
            <CardButton
              key={`${url}-${index}`}
              title={`فيديو ${index + 1}`}
              subtitle={extractHost(url)}
              iconName="play-circle-outline"
              onPress={() => router.push(`/vocab/${id}/watch?video=${index}`)}
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
