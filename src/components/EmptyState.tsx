import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme";
import { rtlTextAlign } from "../utils/rtl";

type Props = {
  title: string;
  subtitle?: string;
};

export function EmptyState({ title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    shadowColor: colors.plumDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  subtitle: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
