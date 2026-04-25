import React from "react";
import { StyleSheet, Text, TextStyle } from "react-native";
import { useAppStore } from "../store/useStore";
import { colors, spacing, typography } from "../theme";
import { rtlTextAlign } from "../utils/rtl";
import { parseRichText, type TextRun } from "../utils/parseRichText";

type Props = {
  children: React.ReactNode;
  style?: TextStyle;
  highlight?: boolean;
};

// Replace {verse text} with ﴿verse text﴾ and flag it as Quranic
function splitAtVerses(text: string): Array<{ content: string; isVerse: boolean }> {
  const parts: Array<{ content: string; isVerse: boolean }> = [];
  const re = /\{([^}]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      if (before) parts.push({ content: before, isVerse: false });
    }
    // Wrap with proper Quranic brackets instead of {}
    parts.push({ content: `﴿${match[1]}﴾`, isVerse: true });
    lastIndex = match.index + match[0].length;
  }

  const tail = text.slice(lastIndex);
  if (tail) parts.push({ content: tail, isVerse: false });

  return parts.length > 0 ? parts : [{ content: text, isVerse: false }];
}

function hasVerseMarkers(text: string): boolean {
  return /\{[^}]+\}/.test(text);
}

function buildRunStyle(run: TextRun, isVerse: boolean): TextStyle {
  const s: TextStyle = {};

  if (isVerse) {
    // Verses always use regular weight — tashkeel is much more legible in regular Amiri
    s.fontFamily = typography.fontFamilyRegular;
    s.color = colors.accentStrong;
  } else {
    if (run.bold && run.italic) {
      s.fontFamily = typography.fontFamilyBoldItalic;
    } else if (run.bold) {
      s.fontFamily = typography.fontFamilyBold;
    } else if (run.italic) {
      s.fontFamily = typography.fontFamilyItalic;
    }
  }

  if (run.underline && run.strikethrough) {
    s.textDecorationLine = "underline line-through";
  } else if (run.underline) {
    s.textDecorationLine = "underline";
  } else if (run.strikethrough) {
    s.textDecorationLine = "line-through";
  }

  if (run.highlight) {
    s.backgroundColor = colors.highlight;
  }

  return s;
}

const PLAIN_RUN: TextRun = {
  text: "",
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  highlight: false,
};

export function ArabicParagraph({ children, style, highlight }: Props) {
  const fontSize = useAppStore((state) => state.settings.fontSize);

  // 2.1× gives tashkeel enough vertical room without awkward gaps on plain lines
  const lineHeight = Math.round(fontSize * 2.1);

  const baseStyle = [
    styles.text,
    {
      fontSize,
      lineHeight,
      backgroundColor: highlight ? colors.highlight : "transparent",
    },
    style,
  ];

  if (typeof children === "string") {
    const runs = parseRichText(children);
    const needsVersePass = hasVerseMarkers(children);

    if (runs || needsVersePass) {
      const normalizedRuns: TextRun[] =
        runs ?? [{ ...PLAIN_RUN, text: children }];

      const segments: Array<{ content: string; runStyle: TextStyle }> = [];

      for (const run of normalizedRuns) {
        for (const part of splitAtVerses(run.text)) {
          segments.push({
            content: part.content,
            runStyle: buildRunStyle(run, part.isVerse),
          });
        }
      }

      return (
        <Text style={baseStyle}>
          {segments.map((seg, i) => (
            <Text key={i} style={seg.runStyle}>
              {seg.content}
            </Text>
          ))}
        </Text>
      );
    }
  }

  return <Text style={baseStyle}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
