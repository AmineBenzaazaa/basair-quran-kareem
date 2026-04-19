import React, { useState } from "react";
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  EmptyState,
  ScreenContainer,
  ScreenHeader,
  SectionTitle,
} from "../../../src/components";
import { useContentData } from "../../../src/content";
import { colors, spacing, typography } from "../../../src/theme";
import { rtlFlexDir } from "../../../src/utils/rtl";
import { rf } from "../../../src/utils/responsive";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getYouTubeVideoId = (url: string) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ?? null;
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery) return fromQuery;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const embedIndex = parts.findIndex((part) => part === "embed");
      if (embedIndex >= 0 && parts[embedIndex + 1]) {
        return parts[embedIndex + 1];
      }
      const shortsIndex = parts.findIndex((part) => part === "shorts");
      if (shortsIndex >= 0 && parts[shortsIndex + 1]) {
        return parts[shortsIndex + 1];
      }
    }
  } catch {
    return null;
  }

  return null;
};

const getEmbedUrl = (url: string) => {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
};

const getThumbnailUrl = (url: string) => {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

export default function VideoWatchScreen() {
  const router = useRouter();
  const content = useContentData();
  const params = useLocalSearchParams<{ id?: string | string[]; video?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const videoParam = Array.isArray(params.video) ? params.video[0] : params.video ?? "0";
  const entry = content.getVocabularyById(id);
  const [opening, setOpening] = useState(false);

  if (!entry) {
    return (
      <ScreenContainer style={styles.container}>
        <EmptyState title="المفردة غير متاحة" />
      </ScreenContainer>
    );
  }

  if (!entry.videoUrls.length) {
    return (
      <ScreenContainer style={styles.container}>
        <EmptyState title="لا توجد فيديوهات لهذه المفردة" />
      </ScreenContainer>
    );
  }

  const parsedIndex = Number(videoParam);
  const safeIndex = Number.isFinite(parsedIndex)
    ? clamp(Math.floor(parsedIndex), 0, entry.videoUrls.length - 1)
    : 0;
  const currentUrl = entry.videoUrls[safeIndex];
  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < entry.videoUrls.length - 1;
  const embedUrl = getEmbedUrl(currentUrl);
  const thumbnailUrl = getThumbnailUrl(currentUrl);
  const canInlinePlay = Platform.OS === "web" && Boolean(embedUrl);

  const openVideo = () => {
    if (opening) return;
    setOpening(true);
    Linking.openURL(currentUrl)
      .catch(() => {})
      .finally(() => setOpening(false));
  };

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title={`مشاهدة · ${entry.phrase}`}
        fallbackHref={`/vocab/${id}/videos`}
      />

      {/* Thumbnail / inline player */}
      {canInlinePlay && embedUrl ? (
        <View style={styles.embedWrap}>
          {React.createElement("iframe", {
            title: `video-${id}-${safeIndex}`,
            src: embedUrl,
            allow:
              "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
            allowFullScreen: true,
            referrerPolicy: "strict-origin-when-cross-origin",
            style: { width: "100%", height: "100%", border: 0, borderRadius: 16 },
          })}
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.thumbnailWrap, pressed && styles.thumbnailPressed]}
          onPress={openVideo}
          disabled={opening}
        >
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailPlaceholder} />
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <MaterialIcons
                name={opening ? "hourglass-empty" : "play-arrow"}
                size={rf(36, 28)}
                color="#fff"
              />
            </View>
          </View>
          <View style={styles.thumbnailLabel}>
            <Text style={styles.thumbnailLabelText}>
              {opening ? "جاري الفتح..." : `فيديو ${safeIndex + 1}`}
            </Text>
          </View>
        </Pressable>
      )}

      <SectionTitle title="الرابط" subtitle={currentUrl} />

      <Pressable
        style={({ pressed }) => [
          styles.openButton,
          (pressed || opening) && styles.openButtonPressed,
        ]}
        onPress={openVideo}
        disabled={opening}
      >
        <MaterialIcons name="open-in-new" size={18} color={colors.surface} style={styles.openButtonIcon} />
        <Text style={styles.openButtonText}>
          {opening ? "جاري الفتح..." : canInlinePlay ? "فتح خارج الصفحة" : "فتح في يوتيوب"}
        </Text>
      </Pressable>

      <View style={styles.navRow}>
        <Pressable
          style={({ pressed }) => [
            styles.navButton,
            !canGoPrev && styles.navButtonDisabled,
            pressed && canGoPrev && styles.navButtonPressed,
          ]}
          disabled={!canGoPrev}
          onPress={() => router.replace(`/vocab/${id}/watch?video=${safeIndex - 1}`)}
        >
          <Text style={styles.navButtonText}>السابق</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.navButton,
            !canGoNext && styles.navButtonDisabled,
            pressed && canGoNext && styles.navButtonPressed,
          ]}
          disabled={!canGoNext}
          onPress={() => router.replace(`/vocab/${id}/watch?video=${safeIndex + 1}`)}
        >
          <Text style={styles.navButtonText}>التالي</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  embedWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#000",
  },
  thumbnailWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.plumDeep,
  },
  thumbnailPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.plumDeep,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  playCircle: {
    width: rf(72, 56),
    height: rf(72, 56),
    borderRadius: rf(36, 28),
    backgroundColor: "rgba(246,48,73,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  thumbnailLabel: {
    position: "absolute",
    bottom: 10,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  thumbnailLabelText: {
    color: "#fff",
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
  },
  openButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accentStrong,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: rtlFlexDir,
    gap: spacing.xs,
  },
  openButtonPressed: {
    opacity: 0.82,
  },
  openButtonIcon: {
    marginTop: 1,
  },
  openButtonText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: colors.surface,
  },
  navRow: {
    flexDirection: rtlFlexDir,
    gap: spacing.md,
  },
  navButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonDisabled: {
    opacity: 0.45,
  },
  navButtonPressed: {
    opacity: 0.85,
  },
  navButtonText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
