import React from "react";
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";
import { rf } from "../utils/responsive";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  withOrnaments?: boolean;
};

export function ScreenContainer({
  children,
  scroll = false,
  style,
  contentContainerStyle,
  backgroundColor = colors.background,
  withOrnaments = false,
}: Props) {
  if (scroll) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor }, style]}>
        <StatusBar style="dark" />
        {withOrnaments ? <BackgroundOrnaments /> : null}
        <ScrollView
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          style={styles.contentLayer}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor }, style]}>
      <StatusBar style="dark" />
      {withOrnaments ? <BackgroundOrnaments /> : null}
      <View style={[styles.contentLayer, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
}

function BackgroundOrnaments() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View style={styles.topWash} />
      <View style={styles.lightBand} />
      <View style={[styles.orb, styles.orbGold]} />
      <View style={[styles.orb, styles.orbPlum]} />
      <View style={styles.bottomWash} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  contentLayer: {
    flex: 1,
    zIndex: 1,
  },
  orb: {
    position: "absolute",
    width: rf(320, 220),
    height: rf(320, 220),
    borderRadius: rf(160, 110),
  },
  topWash: {
    position: "absolute",
    top: -80,
    left: -120,
    width: rf(380, 260),
    height: rf(200, 140),
    borderRadius: 140,
    backgroundColor: "rgba(255, 252, 239, 0.09)",
    transform: [{ rotate: "-8deg" }],
  },
  bottomWash: {
    position: "absolute",
    bottom: -120,
    right: -130,
    width: rf(420, 280),
    height: rf(240, 160),
    borderRadius: 150,
    backgroundColor: "rgba(255, 252, 239, 0.08)",
    transform: [{ rotate: "10deg" }],
  },
  lightBand: {
    position: "absolute",
    top: 170,
    right: -150,
    width: rf(480, 320),
    height: rf(100, 70),
    borderRadius: 120,
    backgroundColor: "rgba(255, 252, 239, 0.06)",
    transform: [{ rotate: "15deg" }],
  },
  orbGold: {
    top: 420,
    left: -200,
    backgroundColor: "rgba(255, 252, 239, 0.06)",
  },
  orbPlum: {
    bottom: -180,
    right: -120,
    backgroundColor: "rgba(255, 252, 239, 0.05)",
  },
});
