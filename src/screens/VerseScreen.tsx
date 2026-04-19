import React, { useEffect, useMemo, useRef } from "react";
import {
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { IconButton } from "../components/IconButton";
import { VerseText } from "../components/VerseText";
import { useDataContent } from "../data";
import { colors, spacing, typography } from "../theme";
import { rtlFlexDir, rtlText } from "../utils/rtl";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Verse">;

export default function VerseScreen({ navigation, route }: Props) {
  const router = useRouter();
  const data = useDataContent();
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);

  const verse = useMemo(() => {
    const requestedId = route.params?.verseId;
    if (requestedId) return data.getVerse(requestedId) ?? data.getDefaultVerse();
    return data.getDefaultVerse();
  }, [route.params?.verseId, data]);

  useEffect(() => {
    if (typeof route.params?.restoreY !== "number") return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, route.params?.restoreY ?? 0),
        animated: false,
      });
    });
  }, [route.params?.restoreY, verse.id]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/menu");
  };

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <IconButton name="arrow-forward" onPress={handleBack} />
            <Text style={styles.title}>نص الآية التفاعلي</Text>
            <View style={{ width: 36 }} />
          </View>
          <Text style={styles.subtitle}>
            اضغط على الكلمة المعلّمة بالأحمر لفتح الشرح مباشرة.
          </Text>
        </View>

        <View style={styles.verseCard}>
          <Text style={styles.meta}>
            سورة {verse.surah} • آية {verse.ayah}
          </Text>
          <VerseText
            tokens={verse.tokens}
            onPressToken={({ token, index }) => {
              const conceptId = token.conceptId ?? data.findConceptIdByAlias(token.t);
              if (!conceptId) return;

              const entry = data.getGlossaryEntry(conceptId);
              const hasTokenParagraph =
                !!token.paragraphId &&
                !!entry?.paragraphs.some((paragraph) => paragraph.id === token.paragraphId);
              const paragraphId = hasTokenParagraph
                ? token.paragraphId
                : entry?.defaultParagraphId;

              navigation.navigate("Sharh", {
                conceptId,
                paragraphId,
                from: {
                  screen: "Verse",
                  verseId: verse.id,
                  selectionStart: index,
                  selectionEnd: index,
                  scrollY: scrollYRef.current,
                },
              });
            }}
          />
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
    textAlign: "center",
    ...rtlText,
    fontFamily: typography.fontFamilyBold,
    fontSize: 24,
    color: colors.textPrimary,
  },
  subtitle: {
    ...rtlText,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  verseCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  meta: {
    ...rtlText,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: colors.accent,
  },
  hint: {
    ...rtlText,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    lineHeight: 22,
    color: colors.muted,
  },
});
