import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CardButton,
  EmptyState,
  ScreenContainer,
  ScreenHeader,
  SectionTitle,
} from "../../../src/components";
import { useContentData } from "../../../src/content";
import { colors, spacing } from "../../../src/theme";
import { rtlFlexDir } from "../../../src/utils/rtl";

export default function RulesOverviewScreen() {
  const router = useRouter();
  const content = useContentData();
  const leadingRules = content.rulesGuideEntries.slice(0, 6);
  const lastRule = content.rulesGuideEntries[6] ?? null;

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader title="القواعد الأساسية" fallbackHref="/menu" />

      <SectionTitle title="القواعد السبع" subtitle="اختر القاعدة" />

      {content.rulesGuideEntries.length === 0 ? (
        <EmptyState title="لا توجد قواعد حالياً" />
      ) : (
        <>
          <View style={styles.grid}>
            {leadingRules.map((rule) => (
              <View key={rule.id} style={styles.gridItem}>
                <CardButton
                  title={`القاعدة ${rule.ruleNumber}`}
                  subtitle={rule.shortTitle}
                  iconName="menu-book"
                  onPress={() => router.push(`/articles/rules/${rule.ruleNumber}`)}
                />
              </View>
            ))}
          </View>

          {lastRule ? (
            <View style={styles.lastRuleWrap}>
              <View style={styles.lastRuleItem}>
                <CardButton
                  title={`القاعدة ${lastRule.ruleNumber}`}
                  subtitle={lastRule.shortTitle}
                  iconName="menu-book"
                  onPress={() =>
                    router.push(`/articles/rules/${lastRule.ruleNumber}`)
                  }
                />
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  grid: {
    flexDirection: rtlFlexDir,
    flexWrap: "wrap",
    gap: spacing.md,
  },
  gridItem: {
    // Each item takes exactly half the row minus the gap.
    flexBasis: "47%",
    flexGrow: 1,
    maxWidth: "50%",
  },
  lastRuleWrap: {
    alignItems: "center",
  },
  lastRuleItem: {
    width: "47%",
  },
});
