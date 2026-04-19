export const getOffsetForMeasuredY = (measuredY: number, headerOffset = 12) =>
  Math.max(0, measuredY - headerOffset);
