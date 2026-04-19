import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, spacing, typography } from "../theme";
import { rf } from "../utils/responsive";

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function TabPill({ label, active, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pill,
        active ? styles.pillActive : null,
        pressed && styles.pillPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.text, active ? styles.textActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexShrink: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillPressed: {
    opacity: 0.85,
  },
  text: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: rf(14, 12),
    color: colors.textSecondary,
  },
  textActive: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBold,
  },
});
