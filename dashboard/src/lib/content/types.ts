export type DashboardModuleId =
  | "intro"
  | "concepts"
  | "rules-article"
  | "method-flow"
  | "method-sections"
  | "glossary"
  | "surahs"
  | "ayahs"
  | "tafsir"
  | "verses-tokens";

export type DashboardModule = {
  id: DashboardModuleId;
  title: string;
  area: string;
  description: string;
  itemLabel: string;
  addActionLabel: string;
  searchPlaceholder: string;
  simpleInstructions: string[];
  repoRelativePath: string;
  seedFileName: string;
  readOnly?: boolean;
};

export type StorageMode = "supabase";

export type DocumentSource = "supabase";

export type ModuleDocument = {
  module: DashboardModule;
  document: unknown;
  summary: string;
  updatedAt: string | null;
  storageMode: StorageMode;
  source: DocumentSource;
  resetSupported: boolean;
  writeTokenRequired: boolean;
};

export type ModuleSummary = {
  module: DashboardModule;
  summary: string;
  updatedAt: string | null;
  storageMode: StorageMode;
  source: DocumentSource;
};
