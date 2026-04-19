import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme";
import { rtlFlexDir , rtlTextAlign} from "../utils/rtl";
import { rf } from "../utils/responsive";

type Props = {
  title: string;
  subtitle?: string;
};

export function SectionTitle({ title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleAccent} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    gap: spacing.sm,
  },
  titleAccent: {
    width: 26,
    height: 3,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  title: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: rf(20, 15),
    color: colors.textPrimary,
  },
  subtitle: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: rf(14, 12),
    color: colors.textSecondary,
  },
});
