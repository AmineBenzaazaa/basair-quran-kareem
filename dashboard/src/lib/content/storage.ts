import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isDashboardAuthEnabled } from "../auth/session";
import { dashboardModules, getDashboardModule } from "./modules";
import { summarizeDocument } from "./summary";
import type {
  DashboardModule,
  DashboardModuleId,
  DocumentSource,
  ModuleDocument,
  ModuleSummary,
  StorageMode,
} from "./types";

type ContentModuleRow = {
  module_id: DashboardModuleId;
  document: unknown;
  updated_at: string | null;
};

type SupabaseConfig = {
  publishableKey: string;
  serviceRoleKey: string;
  url: string;
};

let supabaseAdminClient: SupabaseClient | null = null;
let supabaseClient: SupabaseClient | null = null;

function getSupabaseConfig(): SupabaseConfig {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    "";
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    "";
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ??
    "";

  if (!url || !(publishableKey || serviceRoleKey)) {
    throw new Error(
      "Dashboard requires SUPABASE_URL (or VITE/NEXT_PUBLIC equivalent) plus a Supabase key."
    );
  }

  return {
    publishableKey,
    serviceRoleKey,
    url,
  };
}

type SupabaseErrorDetails = {
  code: string | null;
  details: string | null;
  hint: string | null;
  message: string | null;
};

function extractSupabaseErrorDetails(error: unknown): SupabaseErrorDetails {
  if (!error || typeof error !== "object") {
    return {
      code: null,
      details: null,
      hint: null,
      message: null,
    };
  }

  return {
    code: "code" in error && typeof error.code === "string" ? error.code : null,
    details:
      "details" in error && typeof error.details === "string"
        ? error.details
        : null,
    hint: "hint" in error && typeof error.hint === "string" ? error.hint : null,
    message:
      "message" in error && typeof error.message === "string"
        ? error.message
        : null,
  };
}

export function formatDashboardError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const { code, details, hint, message } = extractSupabaseErrorDetails(error);
  const combined = [message, details, hint].filter(Boolean).join(" ");

  if (
    code === "42P01" ||
    /relation .*content_modules.* does not exist/i.test(combined)
  ) {
    return 'Supabase table "content_modules" is missing. Run the repo Supabase migrations, then `npm run supabase:content:push` from the repo root.';
  }

  if (/permission denied|row-level security/i.test(combined)) {
    return 'Supabase denied access to "content_modules". Set `SUPABASE_SERVICE_ROLE_KEY` for the dashboard server or apply the expected read policy.';
  }

  const parts = [
    message,
    details,
    hint ? `Hint: ${hint}` : null,
    code ? `Code: ${code}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : "Unknown Supabase content error.";
}

function wrapSupabaseError(action: string, error: unknown): Error {
  return new Error(`${action} ${formatDashboardError(error)}`.trim());
}

function getMissingModulesError(missingModuleIds: string[]): Error {
  return new Error(
    `Supabase content_modules is missing: ${missingModuleIds.join(
      ", "
    )}. Run "npm run supabase:content:push" from the repo root.`
  );
}

function getStorageMode(): StorageMode {
  return "supabase";
}

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const config = getSupabaseConfig();
  supabaseClient = createClient(
    config.url,
    config.serviceRoleKey || config.publishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

  return supabaseClient;
}

function getSupabaseAdminClient() {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const config = getSupabaseConfig();
  if (!config.serviceRoleKey) {
    throw new Error(
      "Dashboard writes require SUPABASE_SERVICE_ROLE_KEY on the server."
    );
  }

  supabaseAdminClient = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseAdminClient;
}

function buildModuleDocument(
  module: DashboardModule,
  row: ContentModuleRow
): ModuleDocument {
  return {
    module,
    document: row.document,
    summary: summarizeDocument(module.id, row.document),
    updatedAt: row.updated_at,
    storageMode: getStorageMode(),
    source: "supabase",
    resetSupported: false,
    writeTokenRequired: writeTokenRequired(),
  };
}

function assertAllModulesPresent(
  rows: ContentModuleRow[]
): Map<DashboardModuleId, ContentModuleRow> {
  const rowsById = new Map(rows.map((row) => [row.module_id, row]));
  const missingModuleIds = dashboardModules
    .filter((module) => !rowsById.has(module.id))
    .map((module) => module.id);

  if (missingModuleIds.length) {
    throw getMissingModulesError(missingModuleIds);
  }

  return rowsById;
}

async function readSupabaseDocument(module: DashboardModule) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("content_modules")
    .select("module_id, document, updated_at")
    .eq("module_id", module.id)
    .maybeSingle()
    .returns<ContentModuleRow | null>();

  if (error) {
    throw wrapSupabaseError(
      `Unable to load module "${module.id}" from Supabase.`,
      error
    );
  }

  if (!data) {
    throw getMissingModulesError([module.id]);
  }

  return data;
}

async function readAllSupabaseDocuments() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("content_modules")
    .select("module_id, document, updated_at")
    .in(
      "module_id",
      dashboardModules.map((module) => module.id)
    )
    .returns<ContentModuleRow[]>();

  if (error) {
    throw wrapSupabaseError(
      "Unable to load dashboard content from Supabase.",
      error
    );
  }

  return assertAllModulesPresent(data ?? []);
}

async function writeSupabaseDocument(module: DashboardModule, document: unknown) {
  const client = getSupabaseAdminClient();
  const updatedAt = new Date().toISOString();
  const { data, error } = await client
    .from("content_modules")
    .upsert(
      {
        module_id: module.id,
        document,
        updated_at: updatedAt,
      },
      {
        onConflict: "module_id",
      }
    )
    .select("module_id, document, updated_at")
    .single<ContentModuleRow>();

  if (error) {
    throw wrapSupabaseError(
      `Unable to save module "${module.id}" to Supabase.`,
      error
    );
  }

  return {
    document,
    module_id: module.id,
    updated_at: data?.updated_at ?? updatedAt,
  } satisfies ContentModuleRow;
}

export function writeTokenRequired(): boolean {
  return Boolean(process.env.DASHBOARD_WRITE_TOKEN) && !isDashboardAuthEnabled();
}

export function basicAuthEnabled(): boolean {
  return isDashboardAuthEnabled();
}

export function storageModeLabel(): StorageMode {
  return getStorageMode();
}

export async function listModuleSummaries(): Promise<ModuleSummary[]> {
  const rowsById = await readAllSupabaseDocuments();

  return dashboardModules.map((module) => {
    const row = rowsById.get(module.id);
    if (!row) {
      throw getMissingModulesError([module.id]);
    }

    return {
      module,
      summary: summarizeDocument(module.id, row.document),
      updatedAt: row.updated_at,
      storageMode: getStorageMode(),
      source: "supabase",
    };
  });
}

export async function getModuleDocument(
  moduleId: string
): Promise<ModuleDocument | null> {
  const module = getDashboardModule(moduleId);
  if (!module) {
    return null;
  }

  const row = await readSupabaseDocument(module);
  return buildModuleDocument(module, row);
}

export async function getModuleSummary(
  moduleId: string
): Promise<ModuleSummary | null> {
  const module = getDashboardModule(moduleId);
  if (!module) {
    return null;
  }

  const row = await readSupabaseDocument(module);
  return {
    module,
    summary: summarizeDocument(module.id, row.document),
    updatedAt: row.updated_at,
    storageMode: getStorageMode(),
    source: "supabase",
  };
}

export async function saveModuleDocument(
  moduleId: string,
  document: unknown
): Promise<ModuleDocument | null> {
  const module = getDashboardModule(moduleId);
  if (!module) {
    return null;
  }

  if (moduleId === "verses-tokens") {
    const doc = document as {
      version?: number;
      verses?: Record<string, unknown>;
    };
    const dataToSave = {
      version: doc.version ?? 1,
      verses: doc.verses ?? {},
    };
    const row = await writeSupabaseDocument(module, dataToSave);
    return buildModuleDocument(module, row);
  }

  const row = await writeSupabaseDocument(module, document);
  return buildModuleDocument(module, row);
}

export async function resetModuleDocument(_: string): Promise<ModuleDocument | null> {
  throw new Error(
    'Reset is disabled in Supabase-only mode. Re-run "npm run supabase:content:push" to restore the seeded content.'
  );
}

export function writeAccessAllowed(providedToken: string | null): boolean {
  const expectedToken = process.env.DASHBOARD_WRITE_TOKEN;
  if (!expectedToken) {
    return true;
  }
  return providedToken === expectedToken;
}

export function formatSourceLabel(_: DocumentSource): string {
  return "Supabase";
}

const PDF_BUCKET = "curriculum-pdfs";
const PDF_FILE_KEY = "method-flow.pdf";

async function ensurePdfBucketExists(client: SupabaseClient) {
  const { data: buckets } = await client.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === PDF_BUCKET);
  if (!exists) {
    const { error } = await client.storage.createBucket(PDF_BUCKET, { public: true });
    if (error) throw wrapSupabaseError("Failed to create storage bucket.", error);
  }
}

export async function uploadPdfToStorage(buffer: Buffer): Promise<string> {
  const client = getSupabaseAdminClient();
  await ensurePdfBucketExists(client);
  const { error } = await client.storage
    .from(PDF_BUCKET)
    .upload(PDF_FILE_KEY, buffer, { contentType: "application/pdf", upsert: true });
  if (error) throw wrapSupabaseError("Upload PDF failed.", error);
  const { data: { publicUrl } } = client.storage.from(PDF_BUCKET).getPublicUrl(PDF_FILE_KEY);
  return publicUrl;
}

export async function deletePdfFromStorage(): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client.storage.from(PDF_BUCKET).remove([PDF_FILE_KEY]);
  if (error) throw wrapSupabaseError("Delete PDF failed.", error);
}

type AyahDocumentEntry = {
  surahId?: string;
  ayahNumber?: number;
  textAr?: string;
};

export async function getAyahText(
  surahId: string,
  ayahNumber: number
): Promise<string | null> {
  const module = getDashboardModule("ayahs");
  if (!module) {
    return null;
  }

  const row = await readSupabaseDocument(module);
  if (!Array.isArray(row.document)) {
    return null;
  }

  const ayah = (row.document as AyahDocumentEntry[]).find(
    (entry) =>
      entry.surahId === surahId &&
      entry.ayahNumber === ayahNumber &&
      typeof entry.textAr === "string"
  );

  return ayah?.textAr ?? null;
}
