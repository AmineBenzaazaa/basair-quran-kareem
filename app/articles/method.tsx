import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import {
  ArabicParagraph,
  BackButton,
  EmptyState,
  IconButton,
  ScreenContainer,
  ScreenHeader,
} from "../../src/components";
import { useContentData } from "../../src/content";
import { useAppStore } from "../../src/store/useStore";
import { colors, spacing, typography } from "../../src/theme";
import { rtlFlexDir , rtlTextAlign} from "../../src/utils/rtl";
import { rf } from "../../src/utils/responsive";

type MethodDocument = {
  title?: string;
  pdfUrl?: string;
  pdfContent?: string[];
  sections?: {
    paragraphs?: string[];
  }[];
};

type FlowTone = "green" | "blue" | "yellow" | "mint" | "white";

type FlowCardProps = {
  title?: string;
  body?: string;
  tone?: FlowTone;
  compact?: boolean;
  style?: object;
};

type ContinuationNode =
  | {
      kind: "card";
      title?: string;
      body?: string;
      tone?: FlowTone;
      compact?: boolean;
    }
  | {
      kind: "hint";
      text: string;
    };

const RULE_WORD_TO_NUMBER: Record<string, number> = {
  الأولى: 1,
  الثانية: 2,
  الثالثة: 3,
  الرابعة: 4,
  الخامسة: 5,
  السادسة: 6,
  السابعة: 7,
};

function DownArrow() {
  return (
    <View style={styles.arrowWrap}>
      <MaterialIcons name="south" size={rf(30, 20)} color="#0B1324" />
    </View>
  );
}

function FlowCard({ title, body, tone = "white", compact, style }: FlowCardProps) {
  return (
    <View style={[styles.flowCard, toneStyles[tone], compact && styles.compactCard, style]}>
      {title ? <Text style={styles.flowTitle}>{title}</Text> : null}
      {body ? <ArabicParagraph style={styles.flowBody}>{body}</ArabicParagraph> : null}
    </View>
  );
}

const toneStyles: Record<FlowTone, object> = StyleSheet.create({
  green: {
    backgroundColor: "#08B454",
    borderColor: "#E8B022",
  },
  blue: {
    backgroundColor: "#9EC2E8",
    borderColor: "#7CAAD6",
  },
  yellow: {
    backgroundColor: "#FFC90B",
    borderColor: "#E0A30A",
  },
  mint: {
    backgroundColor: "#B8DBA2",
    borderColor: "#67A850",
  },
  white: {
    backgroundColor: "#FFFFFF",
    borderColor: "#67A850",
  },
});

const toParagraphs = (document: MethodDocument) =>
  (document.sections ?? [])
    .flatMap((section) => section.paragraphs ?? [])
    .map((line) => line.trim())
    .filter(Boolean);

const lineAt = (lines: string[], index: number, fallback = "") =>
  lines[index] ?? fallback;

const parseRuleHeading = (value: string) => {
  const match = value.match(/^القاعدة\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة)\s*:\s*(.+)$/);
  if (!match) return null;
  return {
    ruleNumber: RULE_WORD_TO_NUMBER[match[1]],
    title: match[0],
    shortTitle: match[2].trim() || match[0],
  };
};

const isVerseFlowLine = (line: string) =>
  line.includes("{") &&
  (line.startsWith("الآية") || line.startsWith("سورة") || line.startsWith("{"));

const isContextHintLine = (line: string) =>
  line.startsWith(":") || line.includes("تناقض في سياق الآية");

const isSectionLabelLine = (line: string) =>
  line.startsWith("مثال") ||
  line.startsWith("أمثلة") ||
  line.startsWith("الأمثلة") ||
  line.startsWith("لبّ") ||
  line === "لسان العرب" ||
  line === "اللسان العربي" ||
  line === "الكلمات المركبة" ||
  line === "المصدر القرآني" ||
  (!!line && line.length <= 28 && !line.includes("،") && !line.includes("{"));

const toContinuationNodes = (flowLines: string[]): ContinuationNode[] => {
  const nodes: ContinuationNode[] = [];

  for (const line of flowLines) {
    const cleanLine = line.trim();
    if (!cleanLine) {
      continue;
    }

    if (isContextHintLine(cleanLine)) {
      nodes.push({ kind: "hint", text: cleanLine.replace(/^:\s*/, "") });
      continue;
    }

    if (parseRuleHeading(cleanLine)) {
      nodes.push({
        kind: "card",
        title: cleanLine,
        tone: "green",
        compact: true,
      });
      continue;
    }

    if (cleanLine === "المصدر القرآني") {
      nodes.push({
        kind: "card",
        title: cleanLine,
        tone: "yellow",
        compact: true,
      });
      continue;
    }

    if (isVerseFlowLine(cleanLine)) {
      nodes.push({
        kind: "card",
        body: cleanLine,
        tone: "mint",
      });
      continue;
    }

    if (isSectionLabelLine(cleanLine)) {
      nodes.push({
        kind: "card",
        title: cleanLine,
        compact: true,
      });
      continue;
    }

    nodes.push({
      kind: "card",
      body: cleanLine,
    });
  }

  return nodes;
};

type PdfViewerProps = {
  url: string;
  title: string;
  bookmarkId: string;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
};

function PdfViewer({ url, title, isBookmarked, onToggleBookmark }: PdfViewerProps) {
  const [loading, setLoading] = useState(true);
  // Google Docs viewer renders the PDF natively without needing a PDF plugin
  const viewerUrl = `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}`;

  return (
    <ScreenContainer backgroundColor="#fff">
      {/* Custom header with accent background */}
      <View style={styles.pdfHeader}>
        <BackButton fallbackHref="/menu" color="#fff" size={26} style={styles.pdfHeaderBtn} />
        <Text style={styles.pdfHeaderTitle} numberOfLines={2}>
          {title}
        </Text>
        <IconButton
          name={isBookmarked ? "bookmark" : "bookmark-border"}
          color="#fff"
          size={26}
          style={styles.pdfHeaderBtn}
          onPress={onToggleBookmark}
        />
      </View>

      <View style={styles.pdfWebViewWrap}>
        <WebView
          source={{ uri: viewerUrl }}
          style={styles.pdfWebView}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState={false}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
        />
        {loading ? (
          <View style={styles.pdfLoadingOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

export default function MethodFlowScreen() {
  const content = useContentData();
  const { width } = useWindowDimensions();
  const isWide = width >= 920;
  const chart = content.documents["method-flow"] as MethodDocument;
  const lines = useMemo(() => toParagraphs(chart), [chart]);
  // Must be declared before any early returns to satisfy Rules of Hooks
  const continuationNodes = useMemo(
    () => toContinuationNodes(lines.slice(31)),
    [lines]
  );
  const bookmarkId = "method";
  const isBookmarked = useAppStore((state) =>
    state.isBookmarked("article", bookmarkId)
  );
  const toggleBookmark = useAppStore((state) => state.toggleBookmark);
  const pageTitle = chart.title ?? "الرسم البياني للمنهج القرآني";

  // PDF was uploaded → render pages visually in a WebView
  if (chart.pdfUrl) {
    return (
      <PdfViewer
        url={chart.pdfUrl}
        title={pageTitle}
        bookmarkId={bookmarkId}
        isBookmarked={isBookmarked}
        onToggleBookmark={() =>
          toggleBookmark({
            type: "article",
            id: bookmarkId,
            meta: { title: pageTitle },
          })
        }
      />
    );
  }

  if (lines.length === 0) {
    return (
      <ScreenContainer style={styles.container}>
        <EmptyState title="تعذر تحميل الرسم البياني" />
      </ScreenContainer>
    );
  }

  const displayTitle = lineAt(lines, 0, pageTitle);

  const overviewBody = `${lineAt(lines, 1)} ${lineAt(lines, 2)}`.trim();
  const tafsirTitle = lineAt(lines, 3) ? `1- ${lineAt(lines, 3)}` : "1- التفسير";
  const tafsirBase = lineAt(lines, 4);
  const lexLabel = lineAt(lines, 5);
  const ayahLabel = lineAt(lines, 6);
  const ayahTitle = lineAt(lines, 7);
  const ayahVerse = lineAt(lines, 8);
  const ayahBody = lineAt(lines, 9);
  const lexTitle = lineAt(lines, 10);
  const lexVerse = lineAt(lines, 11);
  const lexBody = lineAt(lines, 12);
  const caution = [lineAt(lines, 13), lineAt(lines, 14), lineAt(lines, 15)]
    .filter(Boolean)
    .join("\n\n");

  const tawilTitle = lineAt(lines, 16, "2- التأويل");
  const tawilBody = lineAt(lines, 17);
  const tawilExamplesLabel = lineAt(lines, 18);
  const tawilExampleA = lineAt(lines, 19);
  const tawilExampleB = lineAt(lines, 20);

  const rule1Title = lineAt(lines, 21);
  const rule1Context = lineAt(lines, 22).replace(/^:\s*/, "");
  const rule1SourceLabel = lineAt(lines, 23);
  const rule1SourceVerse = lineAt(lines, 24);
  const rule1Bridge = lineAt(lines, 26);
  const rule1RightTop = lineAt(lines, 27);
  const rule1LeftTop = lineAt(lines, 28);
  const rule1RightBottom = lineAt(lines, 25);
  const rule1LeftBottom = [lineAt(lines, 29), lineAt(lines, 30)]
    .filter(Boolean)
    .join("\n\n");

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <ScreenHeader
        title={displayTitle}
        fallbackHref="/menu"
        rightSlot={
          <IconButton
            name={isBookmarked ? "bookmark" : "bookmark-border"}
            onPress={() =>
              toggleBookmark({
                type: "article",
                id: bookmarkId,
                meta: { title: displayTitle },
              })
            }
          />
        }
      />

      <View style={styles.diagramSection}>
        <View style={styles.ribbon}>
          <View style={styles.ribbonStemLeft} />
          <View style={styles.ribbonStemRight} />
          <Text style={styles.ribbonText}>{displayTitle}</Text>
        </View>

        <DownArrow />
        <FlowCard body={overviewBody} tone="green" />
        <DownArrow />
        <FlowCard title={tafsirTitle} tone="blue" compact />
        <DownArrow />
        <FlowCard body={tafsirBase} />
        <DownArrow />

        {isWide ? (
          <>
            <View style={styles.branchRow}>
              <FlowCard title={lexLabel} compact style={styles.branchLabel} />
              <FlowCard title={ayahLabel} compact style={styles.branchLabel} />
            </View>
            <View style={styles.branchArrowRow}>
              <MaterialIcons name="south" size={32} color="#0B1324" />
              <MaterialIcons name="south" size={32} color="#0B1324" />
            </View>
            <View style={styles.branchRow}>
              <FlowCard
                title={lexTitle}
                body={[lexVerse, lexBody].filter(Boolean).join("\n\n")}
                style={styles.branchDetail}
              />
              <FlowCard
                title={ayahTitle}
                body={[ayahVerse, ayahBody].filter(Boolean).join("\n\n")}
                style={styles.branchDetail}
              />
            </View>
          </>
        ) : (
          <View style={styles.stackedBranch}>
            <FlowCard title={lexLabel} compact />
            <DownArrow />
            <FlowCard title={lexTitle} body={[lexVerse, lexBody].join("\n\n")} />
            <DownArrow />
            <FlowCard title={ayahLabel} compact />
            <DownArrow />
            <FlowCard title={ayahTitle} body={[ayahVerse, ayahBody].join("\n\n")} />
          </View>
        )}

        <DownArrow />
        <FlowCard body={caution} />
      </View>

      <View style={styles.diagramSection}>
        <FlowCard title={tawilTitle} tone="blue" compact />
        <DownArrow />
        <FlowCard body={tawilBody} />
        <DownArrow />
        <FlowCard title={tawilExamplesLabel} compact />
        <DownArrow />

        {isWide ? (
          <View style={styles.branchRow}>
            <FlowCard body={tawilExampleA} style={styles.branchDetail} />
            <FlowCard body={tawilExampleB} style={styles.branchDetail} />
          </View>
        ) : (
          <View style={styles.stackedBranch}>
            <FlowCard body={tawilExampleA} />
            <DownArrow />
            <FlowCard body={tawilExampleB} />
          </View>
        )}
      </View>

      <View style={styles.diagramSection}>
        <FlowCard title={rule1Title} tone="green" compact />
        <DownArrow />
        <FlowCard title={rule1SourceLabel} tone="yellow" compact />
        {rule1Context ? (
          <Text style={styles.contextHint}>{`(${rule1Context})`}</Text>
        ) : null}
        <DownArrow />
        <FlowCard body={rule1SourceVerse} tone="mint" />
        <DownArrow />
        <FlowCard body={rule1Bridge} />
        <DownArrow />

        {isWide ? (
          <>
            <View style={styles.branchRow}>
              <FlowCard body={rule1RightTop} style={styles.branchDetail} />
              <FlowCard body={rule1LeftTop} style={styles.branchDetail} />
            </View>
            <View style={styles.branchArrowRow}>
              <MaterialIcons name="south" size={32} color="#0B1324" />
              <MaterialIcons name="south" size={32} color="#0B1324" />
            </View>
            <View style={styles.branchRow}>
              <FlowCard body={rule1RightBottom} style={styles.branchDetail} />
              <FlowCard body={rule1LeftBottom} style={styles.branchDetail} />
            </View>
          </>
        ) : (
          <View style={styles.stackedBranch}>
            <FlowCard body={rule1RightTop} />
            <DownArrow />
            <FlowCard body={rule1RightBottom} />
            <DownArrow />
            <FlowCard body={rule1LeftTop} />
            <DownArrow />
            <FlowCard body={rule1LeftBottom} />
          </View>
        )}
      </View>

      {continuationNodes.length > 0 ? (
        <View style={styles.diagramSection}>
          <FlowCard
            title="استكمال الرسم البياني"
            body="الخطوات التفصيلية لباقي القواعد"
            tone="yellow"
            compact
          />
          <DownArrow />
          {continuationNodes.map((node, index) => (
            <React.Fragment key={`continuation-${index}`}>
              {node.kind === "hint" ? (
                <Text style={styles.contextHint}>{`(${node.text})`}</Text>
              ) : (
                <FlowCard
                  title={node.title}
                  body={node.body}
                  tone={node.tone}
                  compact={node.compact}
                />
              )}
              {index < continuationNodes.length - 1 ? <DownArrow /> : null}
            </React.Fragment>
          ))}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pdfHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.35)",
    shadowOpacity: 0,
    elevation: 0,
  },
  pdfHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: colors.accentStrong,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  pdfHeaderTitle: {
    flex: 1,
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: rf(20, 15),
    color: "#fff",
    lineHeight: rf(30, 22),
  },
  pdfWebViewWrap: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  pdfWebView: {
    flex: 1,
    backgroundColor: "#fff",
  },
  pdfLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  diagramSection: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F6F8FC",
    shadowColor: colors.plumDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  ribbon: {
    minHeight: rf(72, 48),
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#111",
    backgroundColor: "#FFF300",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    shadowColor: "#111",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  ribbonStemLeft: {
    position: "absolute",
    left: -2,
    top: 10,
    width: 14,
    height: rf(52, 36),
    borderRadius: 8,
    backgroundColor: "#FFF300",
    borderWidth: 2,
    borderColor: "#111",
  },
  ribbonStemRight: {
    position: "absolute",
    right: -2,
    top: 10,
    width: 14,
    height: rf(52, 36),
    borderRadius: 8,
    backgroundColor: "#FFF300",
    borderWidth: 2,
    borderColor: "#111",
  },
  ribbonText: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: rf(28, 17),
    color: "#111",
  },
  arrowWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
  },
  flowCard: {
    borderWidth: 2,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  compactCard: {
    minHeight: rf(72, 48),
    justifyContent: "center",
  },
  flowTitle: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyBold,
    fontSize: rf(30, 18),
    color: "#0B1324",
  },
  flowBody: {
    textAlign: rtlTextAlign,
    writingDirection: "rtl",
    color: "#0B1324",
    lineHeight: rf(42, 28),
  },
  branchRow: {
    flexDirection: rtlFlexDir,
    gap: spacing.md,
  },
  branchLabel: {
    flex: 1,
  },
  branchDetail: {
    flex: 1,
  },
  branchArrowRow: {
    flexDirection: rtlFlexDir,
    justifyContent: "space-around",
    alignItems: "center",
    minHeight: 26,
  },
  stackedBranch: {
    gap: spacing.sm,
  },
  contextHint: {
    textAlign: "center",
    writingDirection: "rtl",
    fontFamily: typography.fontFamilyRegular,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
