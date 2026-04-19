import { Dimensions } from "react-native";

const BASE_WIDTH = 390;
const scale = Math.min(Dimensions.get("window").width / BASE_WIDTH, 1);

// Scale spacing down on small screens so content breathes without overflowing.
// Values are authored for 390px; small screens get proportionally tighter spacing.
const sp = (value: number, min: number) => Math.max(Math.round(value * scale), min);

export const spacing = {
  xs: sp(6, 4),
  sm: sp(10, 7),
  md: sp(16, 12),
  lg: sp(22, 16),
  xl: sp(30, 22),
  xxl: sp(40, 28),
};
