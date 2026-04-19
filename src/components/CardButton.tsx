import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme";
import { rtlFlexDir , rtlTextAlign} from "../utils/rtl";

type Props = {
  title: string;
  subtitle?: string;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  onPress?: () => void;
};

export function CardButton({ title, subtitle, iconName, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, onPress && pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.glow} />
      <View style={styles.cardHeader}>
        {iconName ? (
          <View style={styles.iconWrap}>
            <MaterialIcons name={iconName} size={20} color={colors.accent} />
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        {onPress ? (
          <MaterialIcons name="chevron-left" size={20} color={colors.textSecondary} />
        ) : null}
      </View>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    shadowColor: colors.plumDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 4,
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  glow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    top: -36,
    left: -32,
    backgroundColor: "rgba(43, 82, 136, 0.1)",
  },
  cardHeader: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    gap: spacing.xs,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(43, 82, 136, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(43, 82, 136, 0.26)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    flex: 1,
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
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
