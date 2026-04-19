export type ArticleSection = {
  heading?: string | null;
  paragraphs: string[];
};

export type Article = {
  id: string;
  title: string;
  sections: ArticleSection[];
};

export type VocabularyEntry = {
  id: string;
  phrase: string;
  variants?: string[];
  keywords?: string[];
  explanation?: string;
  videoUrls: string[];
};

export type Surah = {
  id: string;
  nameAr: string;
  ayahCount: number;
};

export type Ayah = {
  surahId: string;
  ayahNumber: number;
  textAr: string;
};

export type TafsirEntry = {
  surahId: string;
  ayahNumber: number;
  tafsirParagraphs: string[];
};

export type TafsirRange = {
  surahId: string;
  startAyahNumber: number;
  endAyahNumber: number;
  ayahs: Ayah[];
  tafsirParagraphs: string[];
};

export type SearchResult =
  | {
      type: "article";
      id: string;
      title: string;
      snippet?: string;
    }
  | {
      type: "vocab";
      id: string;
      title: string;
      snippet?: string;
    }
  | {
      type: "ayah";
      id: string;
      title: string;
      snippet?: string;
      surahId: string;
      ayahNumber: number;
    };
