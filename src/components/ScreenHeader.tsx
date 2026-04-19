import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BackButton } from "./BackButton";
import { colors, typography } from "../theme";
import { rtlTextAlign } from "../utils/rtl";
import { rf } from "../utils/responsive";

type Props = {
  /** Page title — truncates to one line if too long */
  title: string;
  /** Optional subtitle below the title (e.g. screen description) */
  subtitle?: string;
  /** Where BackButton navigates when there's no history */
  fallbackHref: string;
  /**
   * Optional element on the physical RIGHT side of the header.
   * Pass an <IconButton /> for actions (bookmark, close…).
   * Omit for no right element.
   */
  rightSlot?: React.ReactNode;
};

// Button width (36px from IconButton) + a small gap
const SLOT_WIDTH = 44;

/**
 * Standard screen header — back button always on physical LEFT,
 * optional action always on physical RIGHT, title centred between them.
 *
 * Uses absolute positioning for the side slots so the layout is
 * completely independent of the device RTL setting.
 */
export function ScreenHeader({ title, subtitle, fallbackHref, rightSlot }: Props) {
  return (
    <View style={styles.header}>
      {/* Title block fills the full row, padded so it never overlaps the buttons */}
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Always physically on the LEFT */}
      <View style={styles.leftSlot}>
        <BackButton fallbackHref={fallbackHref} />
      </View>

      {/* Always physically on the RIGHT */}
      {rightSlot != null ? (
        <View style={styles.rightSlot}>{rightSlot}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 44,
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    paddingHorizontal: SLOT_WIDTH,
    gap: 2,
  },
  title: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: rf(20, 14),
    color: colors.textPrimary,
  },
  subtitle: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: rf(13, 11),
    color: colors.textSecondary,
  },
  // position: absolute so left/right always mean PHYSICAL left/right
  // regardless of the device's RTL setting.
  leftSlot: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  rightSlot: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
