import React from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, spacing } from "../theme";

type Props = {
  name: keyof typeof MaterialIcons.glyphMap;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
  size?: number;
  disabled?: boolean;
};

export function IconButton({
  name,
  onPress,
  color = colors.textPrimary,
  style,
  size = 22,
  disabled = false,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
    >
      <MaterialIcons name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    shadowColor: colors.plumDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.94 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
