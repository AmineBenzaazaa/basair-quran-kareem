import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme";
import { rtlFlexDir } from "../utils/rtl";
import { rf } from "../utils/responsive";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder }: Props) {
  return (
    <View style={styles.container}>
      {value ? (
        <Pressable style={styles.clearButton} onPress={() => onChangeText("")}>
          <MaterialIcons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : (
        <MaterialIcons name="search" size={20} color={colors.textSecondary} />
      )}
      <TextInput
        style={styles.input}
        placeholder={placeholder ?? "ابحث"}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        textAlign="right"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.plumDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: rf(16, 13),
    color: colors.textPrimary,
    minWidth: 0,
  },
});
