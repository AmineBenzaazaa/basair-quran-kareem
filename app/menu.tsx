import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import { IconButton, ScreenContainer, SectionTitle } from "../src/components";
import { useContentData } from "../src/content";
import { colors, spacing, typography } from "../src/theme";
import { rtlFlexDir , rtlTextAlign} from "../src/utils/rtl";
import { rf } from "../src/utils/responsive";

type MenuItem = {
  label: string;
  title: string;
  subtitle: string;
  route: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
};

type UtilityItem = {
  title: string;
  subtitle: string;
  route: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
};

type ArticleSection = {
  heading?: string | null;
  paragraphs?: string[];
};

type ConceptsDocument = {
  title?: string;
  sections?: ArticleSection[];
};

const FEATURED_ITEM_FALLBACK: MenuItem = {
  label: "المسار الرئيسي",
  title: "تيسير القرآن بلسان العرب",
  subtitle: "ادخل إلى السور وابدأ القراءة من مدخل واضح ومباشر.",
  route: "/quran",
  icon: "auto-stories",
};

const MENU_ITEMS_FALLBACK: MenuItem[] = [
  {
    label: "مدخل",
    title: "تعريف التطبيق",
    subtitle: "مدخل الفكرة والهدف وطريقة استخدام المادة.",
    route: "/articles/intro",
    icon: "info-outline",
  },
  {
    label: "ضوابط",
    title: "القواعد الأساسية",
    subtitle: "ضوابط التدبر المنهجي وأسس القراءة المنضبطة.",
    route: "/articles/rules",
    icon: "balance",
  },
  {
    label: "خارطة",
    title: "الرسم البياني للمنهج القرآني",
    subtitle: "خارطة انتقال بين المراحل تساعد على رؤية المنهج كاملاً.",
    route: "/articles/method",
    icon: "account-tree",
  },
  {
    label: "دلالات",
    title: "المعاني والدلالات",
    subtitle: "مدخل إلى المفاهيم والمصطلحات الدالة في المنهج.",
    route: "/articles/concepts",
    icon: "library-books",
  },
  {
    label: "مرجع",
    title: "فهرس المفردات",
    subtitle: "رجوع سريع إلى الألفاظ المحورية ومواضعها.",
    route: "/vocab",
    icon: "fact-check",
  },
] as const;

const UTILITY_ITEMS: UtilityItem[] = [
  {
    title: "البحث",
    subtitle: "فتش في السور والآيات",
    route: "/search",
    icon: "search",
  },
  {
    title: "المحفوظات",
    subtitle: "ارجع لما حفظته",
    route: "/bookmarks",
    icon: "favorite-border",
  },
];

const getFirstParagraph = (sections: ArticleSection[] | undefined) => {
  for (const section of sections ?? []) {
    for (const paragraph of section.paragraphs ?? []) {
      const value = paragraph.trim();
      if (value) return value;
    }
  }

  return null;
};

const getFirstHeading = (sections: ArticleSection[] | undefined) => {
  for (const section of sections ?? []) {
    const heading = section.heading?.trim();
    if (heading) return heading;
  }

  return null;
};

const truncateText = (value: string, limit = 88) =>
  value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`;

export default function MainMenuScreen() {
  const router = useRouter();
  const content = useContentData();
  const { width } = useWindowDimensions();
  const canGoBack = router.canGoBack();
  const isWideLayout = width >= 820;
  const utilityColumns = width >= 680 ? 2 : 1;
  const utilityGap = spacing.md;
  const utilityWidth = Math.floor(
    (width - spacing.lg * 2 - utilityGap * (utilityColumns - 1)) / utilityColumns
  );
  const introArticle = content.getArticleById("intro");
  const rulesArticle = content.getArticleById("rules");
  const methodArticle = content.getArticleById("method");
  const conceptsDocument = content.documents.concepts as ConceptsDocument;
  const conceptsPreview =
    getFirstHeading(conceptsDocument.sections) ??
    getFirstParagraph(conceptsDocument.sections);
  const featuredItem: MenuItem = {
    ...FEATURED_ITEM_FALLBACK,
    subtitle:
      content.surahList.length > 0
        ? `${content.surahList.length} سورة متاحة للقراءة والتدبر.`
        : FEATURED_ITEM_FALLBACK.subtitle,
  };
  const menuItems: MenuItem[] = [
    {
      ...MENU_ITEMS_FALLBACK[0],
      title: introArticle?.title?.trim() || MENU_ITEMS_FALLBACK[0].title,
      subtitle: truncateText(
        getFirstParagraph(introArticle?.sections) ?? MENU_ITEMS_FALLBACK[0].subtitle,
      ),
    },
    {
      ...MENU_ITEMS_FALLBACK[1],
      title: rulesArticle?.title?.trim() || MENU_ITEMS_FALLBACK[1].title,
      subtitle: truncateText(
        getFirstParagraph(rulesArticle?.sections) ?? MENU_ITEMS_FALLBACK[1].subtitle,
      ),
    },
    {
      ...MENU_ITEMS_FALLBACK[2],
      title: methodArticle?.title?.trim() || MENU_ITEMS_FALLBACK[2].title,
      subtitle: truncateText(
        getFirstParagraph(methodArticle?.sections) ?? MENU_ITEMS_FALLBACK[2].subtitle,
      ),
    },
    {
      ...MENU_ITEMS_FALLBACK[3],
      title: conceptsDocument.title?.trim() || MENU_ITEMS_FALLBACK[3].title,
      subtitle: truncateText(conceptsPreview ?? MENU_ITEMS_FALLBACK[3].subtitle),
    },
    {
      ...MENU_ITEMS_FALLBACK[4],
      subtitle:
        content.vocabularyEntries.length > 0
          ? `${content.vocabularyEntries.length} مفردة متاحة للرجوع السريع.`
          : MENU_ITEMS_FALLBACK[4].subtitle,
    },
  ];

  const handleBack = () => {
    if (!canGoBack) return;
    router.back();
  };

  return (
    <ScreenContainer scroll withOrnaments contentContainerStyle={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.topActions}>
          <IconButton
            name="search"
            size={20}
            style={styles.topIconButton}
            onPress={() => router.push("/search")}
          />
          <IconButton
            name="favorite-border"
            size={20}
            style={styles.topIconButton}
            onPress={() => router.push("/bookmarks")}
          />
        </View>

        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>المكتبة العلمية</Text>
          <Text style={styles.headerTitle}>القائمة الرئيسية</Text>
        </View>

        {canGoBack ? (
          <IconButton
            name="arrow-forward"
            size={22}
            style={styles.topIconButton}
            onPress={handleBack}
          />
        ) : (
          <View style={styles.topIconPlaceholder} />
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.heroCard, pressed && styles.pressedCard]}
        onPress={() => router.push(featuredItem.route)}
      >
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowSecondary} />

        <View style={styles.heroTopRow}>
          <View style={styles.heroLabel}>
            <Text style={styles.heroLabelText}>{featuredItem.label}</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <MaterialIcons name={featuredItem.icon} size={24} color={colors.surface} />
          </View>
        </View>

        <View style={styles.heroTextBlock}>
          <Text style={styles.heroTitle}>{featuredItem.title}</Text>
          <Text style={styles.heroSubtitle}>{featuredItem.subtitle}</Text>
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.heroMetaRow}>
            <MetaPill label={`${menuItems.length + 1} مسارات`} />
            <MetaPill label="وصول سريع" />
          </View>

          <View style={styles.heroCta}>
            <Text style={styles.heroCtaText}>ابدأ من هنا</Text>
            <MaterialIcons name="arrow-back" size={18} color={colors.surface} />
          </View>
        </View>
      </Pressable>

      {/* <View style={styles.utilitySection}>
        <SectionTitle title="أدوات سريعة" subtitle="اختصارات مباشرة للأكثر استخداماً" />
        <View style={styles.utilityGrid}>
          {UTILITY_ITEMS.map((item) => (
            <Pressable
              key={item.title}
              style={({ pressed }) => [
                styles.utilityCard,
                pressed && styles.pressedCard,
                { width: utilityColumns === 1 ? "100%" : utilityWidth },
              ]}
              onPress={() => router.push(item.route)}
            >
              <View style={styles.utilityIconWrap}>
                <MaterialIcons name={item.icon} size={20} color={colors.accent} />
              </View>
              <View style={styles.utilityTextBlock}>
                <Text style={styles.utilityTitle}>{item.title}</Text>
                <Text style={styles.utilitySubtitle}>{item.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-left" size={22} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </View> */}

      <View style={styles.contentSection}>
        <SectionTitle title="المحتوى العلمي" subtitle="انتقل بين المسارات من واجهة أكثر هدوءاً وتنظيماً" />
        <View style={[styles.menuGrid, isWideLayout && styles.menuGridWide]}>
          {menuItems.map((item) => (
            <MenuCard
              key={String(item.route)}
              item={item}
              isWide={isWideLayout}
              onPress={() => router.push(item.route)}
            />
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

function MenuCard({
  item,
  isWide,
  onPress,
}: {
  item: MenuItem;
  isWide: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuCard,
        isWide && styles.menuCardWide,
        pressed && styles.pressedCard,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuCardGlow} />

      <View style={styles.menuCardHeader}>
        <View style={styles.menuCardBadge}>
          <Text style={styles.menuCardBadgeText}>{item.label}</Text>
        </View>
        <View style={styles.menuCardArrow}>
          <MaterialIcons name="chevron-left" size={20} color={colors.textSecondary} />
        </View>
      </View>

      <View style={styles.menuCardBody}>
        <View style={styles.menuCardIconWrap}>
          <MaterialIcons name={item.icon} size={22} color={colors.accent} />
        </View>
        <View style={styles.menuCardTextBlock}>
          <Text style={styles.menuCardTitle}>{item.title}</Text>
          <Text style={styles.menuCardSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  topRow: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    justifyContent: "space-between",
  },
  topActions: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    gap: spacing.sm,
  },
  topIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  topIconPlaceholder: {
    width: 48,
    height: 48,
  },
  headerTextBlock: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
  },
  headerEyebrow: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  headerTitle: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: rf(22, 16),
    color: colors.textPrimary,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.accent,
    borderRadius: 30,
    padding: spacing.lg,
    gap: spacing.lg,
    shadowColor: colors.plumDeep,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 6,
  },
  pressedCard: {
    opacity: 0.94,
    transform: [{ scale: 0.988 }],
  },
  heroGlowPrimary: {
    position: "absolute",
    top: -48,
    left: -16,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  heroGlowSecondary: {
    position: "absolute",
    bottom: -90,
    right: -30,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  heroTopRow: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLabel: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  heroLabelText: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: colors.surface,
  },
  heroIconWrap: {
    width: rf(48, 36),
    height: rf(48, 36),
    borderRadius: rf(24, 18),
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextBlock: {
    gap: spacing.sm,
  },
  heroTitle: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: rf(29, 19),
    lineHeight: rf(40, 28),
    color: colors.surface,
  },
  heroSubtitle: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: rf(15, 13),
    lineHeight: rf(25, 20),
    color: "rgba(255, 255, 255, 0.82)",
  },
  heroFooter: {
    gap: spacing.md,
  },
  heroMetaRow: {
    flexDirection: rtlFlexDir,
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metaPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  metaPillText: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    color: colors.surface,
  },
  heroCta: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: "rgba(17, 31, 53, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  heroCtaText: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: colors.surface,
  },
  utilitySection: {
    gap: spacing.md,
  },
  utilityGrid: {
    flexDirection: rtlFlexDir,
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  utilityCard: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(17, 31, 53, 0.1)",
    padding: spacing.md,
    shadowColor: colors.plumDeep,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  utilityIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.highlight,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityTextBlock: {
    flex: 1,
    gap: 2,
  },
  utilityTitle: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  utilitySubtitle: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  contentSection: {
    gap: spacing.md,
  },
  menuGrid: {
    gap: spacing.md,
  },
  menuGridWide: {
    flexDirection: rtlFlexDir,
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  menuCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 28,
    padding: spacing.md,
    minHeight: 150,
    borderWidth: 1,
    borderColor: "rgba(17, 31, 53, 0.1)",
    gap: spacing.md,
    shadowColor: colors.plumDeep,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  menuCardWide: {
    width: "48.5%",
  },
  menuCardGlow: {
    position: "absolute",
    top: -56,
    left: -26,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(138, 36, 75, 0.08)",
  },
  menuCardHeader: {
    flexDirection: rtlFlexDir,
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuCardBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(138, 36, 75, 0.08)",
  },
  menuCardBadgeText: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    color: colors.accent,
  },
  menuCardArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCardBody: {
    flexDirection: rtlFlexDir,
    alignItems: "flex-start",
    gap: spacing.md,
  },
  menuCardIconWrap: {
    width: rf(44, 34),
    height: rf(44, 34),
    borderRadius: rf(22, 17),
    backgroundColor: "rgba(138, 36, 75, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(138, 36, 75, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  menuCardTextBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  menuCardTitle: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: rf(20, 15),
    lineHeight: rf(30, 22),
    color: colors.textPrimary,
  },
  menuCardSubtitle: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: rf(13, 12),
    lineHeight: rf(22, 18),
    color: colors.textSecondary,
  },
});
