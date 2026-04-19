import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import type { GlossaryEntry as GlossaryEntryModel, GlossaryParagraph } from "../data";
import { colors, spacing, typography } from "../theme";
import { rtlFlexDir, rtlText } from "../utils/rtl";
import { rf } from "../utils/responsive";

type Props = {
  entry: GlossaryEntryModel;
  highlightedParagraphId?: string | null;
  highlightCycle?: number;
  onParagraphLayout?: (paragraphId: string, y: number) => void;
  onPressVideo?: (url: string) => void;
};

export function GlossaryEntry({
  entry,
  highlightedParagraphId = null,
  highlightCycle = 0,
  onParagraphLayout,
  onPressVideo,
}: Props) {
  const animatedHighlight = useRef(new Animated.Value(0)).current;
  const cardYRef = useRef(0);
  const paragraphWrapYRef = useRef(0);
  const paragraphs = useMemo<GlossaryParagraph[]>(
    () => entry.paragraphs,
    [entry.paragraphs]
  );

  useEffect(() => {
    if (!highlightedParagraphId) return;
    animatedHighlight.setValue(1);
    Animated.timing(animatedHighlight, {
      toValue: 0,
      duration: 1500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [animatedHighlight, highlightCycle, highlightedParagraphId]);

  return (
    <View
      style={styles.card}
      onLayout={(event) => {
        cardYRef.current = event.nativeEvent.layout.y;
      }}
    >
      <Text style={styles.title}>{entry.title}</Text>
      <View
        style={styles.paragraphs}
        onLayout={(event) => {
          paragraphWrapYRef.current = event.nativeEvent.layout.y;
        }}
      >
        {paragraphs.map((paragraph) => (
          <ParagraphItem
            key={paragraph.id}
            paragraph={paragraph}
            highlighted={highlightedParagraphId === paragraph.id}
            animatedHighlight={animatedHighlight}
            onLayout={onParagraphLayout}
            yOffsetRef={paragraphWrapYRef}
            cardYRef={cardYRef}
          />
        ))}
      </View>

      {entry.related?.length ? (
        <Text style={styles.metaText}>مرتبطة بـ: {entry.related.join(" • ")}</Text>
      ) : null}

      {entry.videos?.length ? (
        <View style={styles.videosWrap}>
          {entry.videos.map((video) => (
            <Pressable
              key={video.url}
              onPress={() => onPressVideo?.(video.url)}
              style={({ pressed }) => [styles.videoButton, pressed && styles.videoPressed]}
            >
              <Text style={styles.videoText}>{video.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type ParagraphItemProps = {
  paragraph: GlossaryParagraph;
  highlighted: boolean;
  animatedHighlight: Animated.Value;
  onLayout?: (paragraphId: string, y: number) => void;
  yOffsetRef: React.MutableRefObject<number>;
  cardYRef: React.MutableRefObject<number>;
};

function ParagraphItem({
  paragraph,
  highlighted,
  animatedHighlight,
  onLayout,
  yOffsetRef,
  cardYRef,
}: ParagraphItemProps) {
  const animatedBackground = animatedHighlight.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceAlt, "rgba(246, 48, 73, 0.30)"],
  });

  return (
    <Animated.View
      onLayout={(event) => {
        const absoluteY =
          cardYRef.current + yOffsetRef.current + event.nativeEvent.layout.y;
        onLayout?.(paragraph.id, absoluteY);
      }}
      style={[
        styles.paragraphWrap,
        highlighted && {
          backgroundColor: animatedBackground,
          borderColor: colors.primary,
        },
      ]}
    >
      <Text style={styles.paragraph}>{paragraph.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    ...rtlText,
    fontFamily: typography.fontFamilyBold,
    fontSize: rf(20, 15),
    color: colors.textPrimary,
  },
  paragraphs: {
    gap: spacing.sm,
  },
  paragraphWrap: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
  },
  paragraph: {
    ...rtlText,
    fontFamily: typography.fontFamilyRegular,
    fontSize: rf(17, 14),
    lineHeight: rf(30, 22),
    color: colors.textPrimary,
  },
  metaText: {
    ...rtlText,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  videosWrap: {
    flexDirection: rtlFlexDir,
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  videoButton: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  videoPressed: {
    opacity: 0.8,
  },
  videoText: {
    ...rtlText,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: colors.accent,
  },
});
