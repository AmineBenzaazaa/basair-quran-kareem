import { I18nManager, Platform, type TextStyle, type ViewStyle } from "react-native";

export const isRTL = I18nManager.isRTL;

// On Android with isRTL=true, textAlign is layout-relative: "right" maps to
// the logical END which is the visual LEFT in RTL layout. Using "left" maps to
// the logical START which is the visual RIGHT — what we actually want.
// On iOS, "right" is always absolute visual-right regardless of RTL mode.
export const rtlTextAlign: TextStyle["textAlign"] =
  Platform.OS === "android" && I18nManager.isRTL ? "left" : "right";

export const rtlText: TextStyle = {
  textAlign: rtlTextAlign,
  writingDirection: "rtl",
};

// When the system is already in RTL mode (isRTL=true), use "row" — the native
// layout engine mirrors it to the correct right-to-left visual order.
// When isRTL=false (manual RTL simulation), use "row-reverse" to achieve the
// same visual result without native mirroring.
export const rtlFlexDir: "row" | "row-reverse" = I18nManager.isRTL ? "row" : "row-reverse";

export const rtlRow: ViewStyle = {
  flexDirection: rtlFlexDir,
};
