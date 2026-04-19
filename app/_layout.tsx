import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  I18nManager,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useFonts, Amiri_400Regular, Amiri_700Bold } from "@expo-google-fonts/amiri";
import * as SplashScreen from "expo-splash-screen";
import { useContentBootstrap, type SyncProgress } from "../src/content/sync";

// Allow the system layout direction to be RTL when the device language is Arabic.
// "supportsRTL": true in app.json is also required for Android.
// Do NOT call forceRTL here: on Android, forceRTL sets isRTL=true in JS
// immediately but the native layout only becomes RTL after a full restart, so
// calling it causes a mismatch where JS code treats the layout as RTL while the
// native engine is still LTR — producing worse results than not calling it at all.
I18nManager.allowRTL(true);
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash is already being managed by the platform.
});

const PURPLE = "#574B8C";

function LoadingScreen({
  downloading,
  syncProgress,
  fontsReady,
}: {
  downloading: boolean;
  syncProgress: SyncProgress;
  fontsReady: boolean;
}) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [fadeAnim, spinAnim]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Show a determinate bar when we know exactly how many modules remain.
  const progressFraction =
    syncProgress && syncProgress.total > 0
      ? syncProgress.downloaded / syncProgress.total
      : null;
  const progressPercent =
    progressFraction === null ? null : Math.max(5, Math.round(progressFraction * 100));

  return (
    <View style={styles.loadingScreen}>
      <Image
        source={require("../assets/images/icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={[styles.appName, fontsReady && styles.brandTextBold]}>
        بصائر القرآن الكريم
      </Text>

      <View style={styles.setupBadge}>
        <Text style={[styles.setupBadgeText, fontsReady && styles.brandTextBold]}>
          تهيئة التطبيق
        </Text>
      </View>

      {progressFraction === null ? (
        <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
      ) : (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                { width: `${progressPercent ?? 0}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressPercent, fontsReady && styles.brandTextBold]}>
            {progressPercent}%
          </Text>
        </View>
      )}

      {downloading ? (
        <Animated.View style={{ opacity: fadeAnim, alignItems: "center" }}>
          <Text style={[styles.loadingTitle, fontsReady && styles.brandTextBold]}>
            {syncProgress
              ? `جاري تنزيل المحتوى ${syncProgress.downloaded + 1} / ${syncProgress.total}`
              : "جاري تجهيز المحتوى الأولي"}
          </Text>
          <Text style={[styles.loadingSub, fontsReady && styles.brandTextRegular]}>
            {syncProgress
              ? "هذه الخطوة تتم مرة واحدة فقط، وبعدها يعمل التطبيق من النسخة المحلية بسرعة."
              : `يتم تحميل البيانات للمرة الأولى فقط،\nسيكون التطبيق سريعاً في المرات القادمة`}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View style={{ opacity: fadeAnim, alignItems: "center" }}>
          <Text style={[styles.loadingTitle, fontsReady && styles.brandTextBold]}>
            جاري التحقق من آخر تحديثات المحتوى
          </Text>
          <Text style={[styles.loadingSub, fontsReady && styles.brandTextRegular]}>
            سيتم فتح التطبيق حالاً بعد اكتمال الفحص الأولي.
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
  });
  const [canHideSplash, setCanHideSplash] = useState(false);
  const content = useContentBootstrap();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setCanHideSplash(true);
      return;
    }

    const timeout = setTimeout(() => {
      setCanHideSplash(true);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError]);

  // Hand off to the JS loading screen quickly. Waiting indefinitely for fonts
  // makes Android look frozen on the native splash.
  useEffect(() => {
    if (!canHideSplash) return;
    void SplashScreen.hideAsync().catch(() => {});
  }, [canHideSplash]);

  if (!canHideSplash || !content.ready) {
    if (content.error) {
      return (
        <View style={styles.errorScreen}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.errorLogo}
            resizeMode="contain"
          />
          <Text style={[styles.errorTitle, fontsLoaded && styles.brandTextBold]}>
            تعذّر تحميل المحتوى
          </Text>
          <Text
            style={[styles.errorBody, fontsLoaded && styles.brandTextRegular]}
            numberOfLines={4}
          >
            {content.error}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            onPress={content.retry}
          >
            <Text style={[styles.retryText, fontsLoaded && styles.brandTextBold]}>
              إعادة المحاولة
            </Text>
          </Pressable>
        </View>
      );
    }
    return (
      <LoadingScreen
        downloading={content.downloading}
        syncProgress={content.syncProgress}
        fontsReady={fontsLoaded}
      />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  // Loading / splash screen
  loadingScreen: {
    flex: 1,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 20,
  },
  logo: {
    width: 200,
    height: 200,
    borderRadius: 36,
  },
  appName: {
    fontSize: 30,
    color: "#ffffff",
    textAlign: "center",
  },
  brandTextBold: {
    fontFamily: "Amiri_700Bold",
  },
  brandTextRegular: {
    fontFamily: "Amiri_400Regular",
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
    borderTopColor: "#ffffff",
    marginTop: 8,
  },
  setupBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  setupBadgeText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    textAlign: "center",
  },
  progressWrap: {
    width: 240,
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  progressTrack: {
    width: "100%",
    height: 7,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 999,
  },
  progressPercent: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 15,
    textAlign: "center",
  },
  loadingTitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginTop: 12,
  },
  loadingSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 26,
    marginTop: 6,
  },

  // Error screen
  errorScreen: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  errorLogo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginBottom: 24,
    opacity: 0.6,
  },
  errorTitle: {
    color: "#0f172a",
    fontSize: 26,
    marginBottom: 12,
    textAlign: "center",
  },
  errorBody: {
    color: "#64748b",
    fontSize: 17,
    lineHeight: 30,
    textAlign: "center",
    marginBottom: 36,
  },
  retryButton: {
    backgroundColor: PURPLE,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  retryButtonPressed: {
    opacity: 0.75,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 18,
    textAlign: "center",
  },
});
