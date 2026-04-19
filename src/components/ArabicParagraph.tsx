import React from "react";
import { StyleSheet, Text, TextStyle } from "react-native";
import { useAppStore } from "../store/useStore";
import { colors, typography } from "../theme";
import { rtlTextAlign } from "../utils/rtl";

type Props = {
  children: React.ReactNode;
  style?: TextStyle;
  highlight?: boolean;
};

export function ArabicParagraph({ children, style, highlight }: Props) {
  const fontSize = useAppStore((state) => state.settings.fontSize);
  return (
    <Text
      style={[
        styles.text,
        {
          fontSize,
          lineHeight: Math.round(fontSize * 1.7),
          backgroundColor: highlight ? colors.highlight : "transparent",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    color: colors.textPrimary,
  },
});
