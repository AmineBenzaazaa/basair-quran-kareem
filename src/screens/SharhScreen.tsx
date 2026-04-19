import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GlossaryEntry } from "../components/GlossaryEntry";
import { EmptyState } from "../components/EmptyState";
import { IconButton } from "../components/IconButton";
import { useDataContent } from "../data";
import { colors, spacing, typography } from "../theme";
import { rtlFlexDir, rtlText } from "../utils/rtl";
import { getOffsetForMeasuredY } from "../utils/scroll";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Sharh">;

export default function SharhScreen({ navigation, route }: Props) {
  const router = useRouter();
  const data = useDataContent();
  const conceptId = route.params?.conceptId ?? "";
  const from = route.params?.from;
  const entry = data.getGlossaryEntry(conceptId);
  const targetParagraphId = route.params?.paragraphId ?? entry?.defaultParagraphId ?? null;

  const scrollRef = useRef<ScrollView>(null);
  // paragraphId -> y offset inside the ScrollView content for precise deep-linking.
  const paragraphYRef = useRef<Record<string, number>>({});

  const [pendingParagraphId, setPendingParagraphId] = useState<string | null>(
    targetParagraphId
  );
  const [highlightedParagraphId, setHighlightedParagraphId] = useState<string | null>(
    targetParagraphId
  );
  const [highlightCycle, setHighlightCycle] = useState(0);

  const scrollToParagraph = useCallback((paragraphId: string, animated: boolean) => {
    const y = paragraphYRef.current[paragraphId];
    if (typeof y !== "number") return false;

    scrollRef.current?.scrollTo({
      y: getOffsetForMeasuredY(y, 16),
      animated,
    });
    setHighlightedParagraphId(paragraphId);
    setHighlightCycle((value) => value + 1);
    return true;
  }, []);

  useEffect(() => {
    if (!targetParagraphId) return;
    setPendingParagraphId(targetParagraphId);
    setHighlightedParagraphId(targetParagraphId);
  }, [conceptId, targetParagraphId]);

  useEffect(() => {
    if (!pendingParagraphId) return;
    const timeout = setTimeout(() => {
      if (scrollToParagraph(pendingParagraphId, true)) {
        setPendingParagraphId(null);
      }
    }, 80);
    return () => clearTimeout(timeout);
  }, [pendingParagraphId, scrollToParagraph]);

  useEffect(() => {
    if (!highlightedParagraphId) return;
    const timeout = setTimeout(() => setHighlightedParagraphId(null), 1500);
    return () => clearTimeout(timeout);
  }, [highlightedParagraphId, highlightCycle]);

  const handleParagraphLayout = (paragraphId: string, y: number) => {
    paragraphYRef.current[paragraphId] = y;
    if (pendingParagraphId !== paragraphId) return;

    requestAnimationFrame(() => {
      if (scrollToParagraph(paragraphId, false)) {
        setPendingParagraphId(null);
      }
    });
  };

  const handleOpenVideo = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  const handleBackToVerse = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    navigation.navigate("Verse", {
      verseId: from?.verseId,
      restoreY: from?.scrollY,
    });
  };

  if (!entry) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <EmptyState title="لم يتم العثور على الشرح" subtitle={`conceptId: ${conceptId}`} />
          <Pressable
            onPress={handleBackToVerse}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Text style={styles.backButtonText}>العودة إلى الآية</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <IconButton name="arrow-forward" onPress={handleBackToVerse} />
            <Text style={styles.title}>الشرح</Text>
            <View style={{ width: 36 }} />
          </View>
          <Text style={styles.subtitle}>
            {entry.title}
          </Text>
          <Text style={styles.fromMeta}>
            المفهوم: <Text style={styles.inlineCode}>{conceptId}</Text> • المصدر:{" "}
            {from?.screen ?? "غير محدد"} • {from?.verseId ?? "—"}
          </Text>
        </View>

        <View style={styles.list}>
          <GlossaryEntry
            entry={entry}
            highlightedParagraphId={highlightedParagraphId}
            highlightCycle={highlightCycle}
            onParagraphLayout={handleParagraphLayout}
            onPressVideo={handleOpenVideo}
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
    flex: 1,
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
    fontSize: 14,
    color: colors.textSecondary,
  },
  inlineCode: {
    fontFamily: typography.fontFamilyBold,
    color: colors.accent,
  },
  fromMeta: {
    ...rtlText,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    color: colors.muted,
  },
  backButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPressed: {
    opacity: 0.85,
  },
  backButtonText: {
    ...rtlText,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  list: {
    gap: spacing.md,
  },
});
