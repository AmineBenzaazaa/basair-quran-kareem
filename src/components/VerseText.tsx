import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { VerseToken } from "../data";
import { colors, spacing, typography } from "../theme";
import { rf } from "../utils/responsive";
import { rtlRow, rtlText } from "../utils/rtl";

type Props = {
  tokens: VerseToken[];
  onPressToken?: (payload: { token: VerseToken; index: number }) => void;
};

export function VerseText({ tokens, onPressToken }: Props) {
  return (
    <View style={styles.container}>
      {tokens.map((token, index) => {
        const isInteractive = token.style === "red";
        return (
          <Pressable
            key={`${token.t}-${index}-${token.conceptId ?? "plain"}`}
            disabled={!isInteractive}
            hitSlop={10}
            style={({ pressed }) => [
              styles.tokenChip,
              isInteractive && styles.tokenChipInteractive,
              pressed && isInteractive && styles.tokenChipPressed,
            ]}
            onPress={() => onPressToken?.({ token, index })}
          >
            <Text
              style={[
                styles.tokenText,
                isInteractive && styles.tokenTextInteractive,
              ]}
            >
              {token.t}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...rtlRow,
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  tokenChip: {
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  tokenChipInteractive: {
    backgroundColor: colors.highlight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tokenChipPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.97 }],
  },
  tokenText: {
    ...rtlText,
    fontFamily: typography.fontFamilyRegular,
    fontSize: rf(24, 17),
    lineHeight: rf(36, 26),
    color: colors.textPrimary,
  },
  tokenTextInteractive: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
  },
});
