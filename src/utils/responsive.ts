import { Dimensions } from "react-native";

/**
 * Design base width — all size values in StyleSheet are authored for this width.
 * Values scale down on smaller screens, cap at 1× on larger screens.
 */
const BASE_WIDTH = 390;

/**
 * Responsive scale — returns a size scaled to the current window width.
 *
 * Safe to call inside StyleSheet.create() because Dimensions.get() is
 * synchronous and the window size is settled before module evaluation on
 * both iOS and Android (portrait-only app, so no rotation to worry about).
 *
 * @param size - the authored value at BASE_WIDTH (390 px)
 * @param min  - floor so tiny screens stay readable (default: no floor)
 */
export function rf(size: number, min?: number): number {
  const { width } = Dimensions.get("window");
  const scale = Math.min(width / BASE_WIDTH, 1); // never grow above designed size
  const result = Math.round(size * scale);
  return min !== undefined ? Math.max(result, min) : result;
}

/**
 * Returns the current scale factor (0 < s ≤ 1).
 * Useful for scaling non-font dimensions (padding, icon sizes, etc.).
 */
export function screenScale(): number {
  const { width } = Dimensions.get("window");
  return Math.min(width / BASE_WIDTH, 1);
}
