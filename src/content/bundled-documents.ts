import intro from "../../dashboard/src/lib/content/seeds/intro.json";
import concepts from "../../dashboard/src/lib/content/seeds/concepts.json";
import rulesArticle from "../../dashboard/src/lib/content/seeds/rules-article.json";
import methodFlow from "../../dashboard/src/lib/content/seeds/method-flow.json";
import methodSections from "../../dashboard/src/lib/content/seeds/method-sections.json";
import glossary from "../../dashboard/src/lib/content/seeds/glossary.json";
import surahs from "../../dashboard/src/lib/content/seeds/surahs.json";
import ayahs from "../../dashboard/src/lib/content/seeds/ayahs.json";
import tafsir from "../../dashboard/src/lib/content/seeds/tafsir.json";
import versesTokens from "../../dashboard/src/lib/content/seeds/verses-tokens.json";
import { assertCompleteContentDocuments, type ContentDocuments } from "./documents";

let bundledDocuments: ContentDocuments | null = null;

export function getBundledContentDocuments(): ContentDocuments {
  if (bundledDocuments) {
    return bundledDocuments;
  }

  bundledDocuments = assertCompleteContentDocuments({
    intro,
    concepts,
    "rules-article": rulesArticle,
    "method-flow": methodFlow,
    "method-sections": methodSections,
    glossary,
    surahs,
    ayahs,
    tafsir,
    "verses-tokens": versesTokens,
  });

  return bundledDocuments;
}
