import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
// Core modules (~2.9 MB) — bundled so the app works offline immediately.
import intro from "../../dashboard/src/lib/content/seeds/intro.json";
import concepts from "../../dashboard/src/lib/content/seeds/concepts.json";
import rulesArticle from "../../dashboard/src/lib/content/seeds/rules-article.json";
import methodFlow from "../../dashboard/src/lib/content/seeds/method-flow.json";
import methodSections from "../../dashboard/src/lib/content/seeds/method-sections.json";
import glossary from "../../dashboard/src/lib/content/seeds/glossary.json";
import surahs from "../../dashboard/src/lib/content/seeds/surahs.json";
import ayahs from "../../dashboard/src/lib/content/seeds/ayahs.json";
// Heavy modules (tafsir 5.8 MB + verses-tokens 6.5 MB) are loaded lazily via
// require() so Metro does NOT parse them at startup — they are resolved only
// when getBundledContentDocuments() is called for the first time.
function loadHeavySeeds(): { tafsir: unknown; versesTokens: unknown } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tafsir = require("../../dashboard/src/lib/content/seeds/tafsir.json") as unknown;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const versesTokens = require("../../dashboard/src/lib/content/seeds/verses-tokens.json") as unknown;
  return { tafsir, versesTokens };
}
import {
  CONTENT_MODULE_IDS,
  assertCompleteContentDocuments,
  type ContentDocuments,
  type ContentModuleId,
} from "./documents";
import { applyContentDocuments } from "./index";
import { applyDataDocuments } from "../data/load";
import { bumpContentVersion } from "./version-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Per-module filesystem cache avoids AsyncStorage size limits on Android.
const CACHE_DIRECTORY = `${FileSystem.documentDirectory ?? ""}content-modules-v2/`;
const CACHE_MANIFEST_FILE = `${CACHE_DIRECTORY}manifest.json`;
const FETCH_TIMEOUT_MS = 300_000;
const POLL_INTERVAL_MS = 15_000;
const REFRESH_DEBOUNCE_MS = 750;
const INITIAL_SYNC_GRACE_MS = 12_000;
const RETRY_BACKOFF_BASE_MS = 30_000;
const RETRY_BACKOFF_MAX_MS = 5 * 60_000;
const FAILURE_LOG_COOLDOWN_MS = 60_000;
const ENABLE_SYNC_DEBUG_LOGS = false;
const CMS_MODULE_IDS: readonly ContentModuleId[] = [
  "intro",
  "concepts",
  "rules-article",
  "method-flow",
  "method-sections",
  "glossary",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModuleEntry = {
  document: unknown;
  updatedAt: string | null;
};

/** Per-module cache: each module's document + the server timestamp at fetch time. */
type ModuleCache = Partial<Record<ContentModuleId, ModuleEntry>>;
type ModuleCacheManifest = Partial<
  Record<
    ContentModuleId,
    {
      updatedAt: string | null;
    }
  >
>;

type ContentModuleTimestamp = {
  module_id: ContentModuleId;
  updated_at: string | null;
};

type ContentModuleRow = {
  module_id: ContentModuleId;
  document: unknown;
};

type AppSupabaseConfig = {
  url: string;
  publishableKey: string;
};

const VALID_GLOSSARY_STATUSES = new Set([
  "ok",
  "needs_review",
  "missing_source",
]);

type SupabaseErrorDetails = {
  code: string | null;
  details: string | null;
  hint: string | null;
  message: string | null;
};

export type SyncProgress = { downloaded: number; total: number } | null;
export type RefreshContentOptions = {
  force?: boolean;
};

export type RefreshContentResult = {
  downloadedModuleIds: ContentModuleId[];
  forced: boolean;
  hasChanges: boolean;
};

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let initialized = false;
let supabaseSyncStarted = false;
let initializationPromise: Promise<void> | null = null;
let inFlightRefresh: Promise<RefreshContentResult> | null = null;
let syncChannel: RealtimeChannel | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let supabaseClient: SupabaseClient | null = null;
let bundledDocuments: ContentDocuments | null = null;
let scheduledRefreshHandle: ReturnType<typeof setTimeout> | null = null;
let pendingForceRefresh = false;
let consecutiveRefreshFailures = 0;
let nextRefreshAllowedAt = 0;
let lastFailureMessage = "";
let lastFailureLoggedAt = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeGlossaryStatus(value: unknown): string {
  const status = typeof value === "string" ? value.trim() : "";

  if (VALID_GLOSSARY_STATUSES.has(status)) {
    return status;
  }

  if (status === "published") {
    return "ok";
  }

  if (status === "missingSource") {
    return "missing_source";
  }

  return "needs_review";
}

function sanitizeModuleDocument(
  moduleId: ContentModuleId,
  document: unknown,
): unknown {
  if (moduleId !== "glossary" || !isRecord(document) || !isRecord(document.entries)) {
    return document;
  }

  let changed = false;
  const nextEntries = Object.fromEntries(
    Object.entries(document.entries).map(([entryId, entry]) => {
      if (!isRecord(entry)) {
        return [entryId, entry];
      }

      const nextStatus = normalizeGlossaryStatus(entry.status);
      if (entry.status === nextStatus) {
        return [entryId, entry];
      }

      changed = true;
      return [
        entryId,
        {
          ...entry,
          status: nextStatus,
        },
      ];
    }),
  );

  if (!changed) {
    return document;
  }

  return {
    ...document,
    entries: nextEntries,
  };
}

// ---------------------------------------------------------------------------
// Progress — module-level so all listeners (timers, realtime, retry) share it
// ---------------------------------------------------------------------------

let _syncProgress: SyncProgress = null;
const _progressListeners = new Set<() => void>();

function setSyncProgress(p: SyncProgress) {
  _syncProgress = p;
  _progressListeners.forEach((fn) => fn());
}

function getBundledContentDocuments(): ContentDocuments {
  if (bundledDocuments) return bundledDocuments;

  const { tafsir, versesTokens } = loadHeavySeeds();
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

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

function formatSyncError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message ?? "";

    // Network failures on Android/Hermes include the full stack in the message.
    if (/network request failed/i.test(msg)) {
      return "تعذّر الاتصال بالخادم. يُرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.";
    }

    // Our own timeout / already-Arabic messages — pass through as-is.
    if (msg && !msg.includes("://") && !msg.includes("at anonymous")) {
      return msg;
    }
  }

  const { code, details, hint, message } = extractSupabaseErrorDetails(error);
  const combined = [message, details, hint].filter(Boolean).join(" ");

  if (
    code === "42P01" ||
    /relation .*content_modules.* does not exist/i.test(combined)
  ) {
    return 'Supabase table "content_modules" is missing. Run migrations then `npm run supabase:content:push`.';
  }

  if (/permission denied|row-level security/i.test(combined)) {
    return 'Supabase denied access to "content_modules". Verify the public read policy or the publishable key.';
  }

  const parts = [
    message,
    details,
    hint ? `Hint: ${hint}` : null,
    code ? `Code: ${code}` : null,
  ].filter(Boolean);

  if (parts.length) return parts.join(" ");
  if (typeof error === "string" && error.trim()) return error.trim();

  if (error && typeof error === "object") {
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Non-serializable — fall through.
    }
  }

  return "Unknown Supabase content error.";
}

function extractSupabaseErrorDetails(error: unknown): SupabaseErrorDetails {
  if (!error || typeof error !== "object") {
    return { code: null, details: null, hint: null, message: null };
  }
  return {
    code: "code" in error && typeof error.code === "string" ? error.code : null,
    details:
      "details" in error && typeof error.details === "string" ? error.details : null,
    hint: "hint" in error && typeof error.hint === "string" ? error.hint : null,
    message:
      "message" in error && typeof error.message === "string" ? error.message : null,
  };
}

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getSupabaseConfig(): AppSupabaseConfig | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const url =
    (typeof extra.supabaseUrl === "string" ? extra.supabaseUrl : "") ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const publishableKey =
    (typeof extra.supabasePublishableKey === "string"
      ? extra.supabasePublishableKey
      : "") ||
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    "";

  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const config = getSupabaseConfig();
  if (!config) return null;
  supabaseClient = createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return supabaseClient;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function loadModuleCache(): Promise<ModuleCache | null> {
  if (!FileSystem.documentDirectory) {
    return null;
  }

  try {
    const manifestInfo = await FileSystem.getInfoAsync(CACHE_MANIFEST_FILE);
    if (!manifestInfo.exists) return null;

    const raw = await FileSystem.readAsStringAsync(CACHE_MANIFEST_FILE);
    if (!raw) return null;
    const manifest = JSON.parse(raw) as ModuleCacheManifest;
    const cache: ModuleCache = {};

    for (const moduleId of CONTENT_MODULE_IDS) {
      const manifestEntry = manifest[moduleId];
      if (!manifestEntry) continue;

      const moduleFile = `${CACHE_DIRECTORY}${moduleId}.json`;
      const moduleInfo = await FileSystem.getInfoAsync(moduleFile);
      if (!moduleInfo.exists) {
        return null;
      }

      const documentRaw = await FileSystem.readAsStringAsync(moduleFile);
      cache[moduleId] = {
        document: sanitizeModuleDocument(
          moduleId,
          JSON.parse(documentRaw) as unknown,
        ),
        updatedAt: manifestEntry.updatedAt ?? null,
      };
    }

    return Object.keys(cache).length ? cache : null;
  } catch {
    return null;
  }
}

async function saveModuleCache(
  cache: ModuleCache,
  changedModuleIds: readonly ContentModuleId[] = CONTENT_MODULE_IDS,
): Promise<void> {
  if (!FileSystem.documentDirectory) {
    return;
  }

  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, { intermediates: true });

    const manifestInfo = await FileSystem.getInfoAsync(CACHE_MANIFEST_FILE);
    let manifest: ModuleCacheManifest = {};

    if (manifestInfo.exists) {
      try {
        manifest = JSON.parse(
          await FileSystem.readAsStringAsync(CACHE_MANIFEST_FILE),
        ) as ModuleCacheManifest;
      } catch {
        manifest = {};
      }
    }

    for (const moduleId of changedModuleIds) {
      const entry = cache[moduleId];
      if (!entry) continue;

      await FileSystem.writeAsStringAsync(
        `${CACHE_DIRECTORY}${moduleId}.json`,
        JSON.stringify(entry.document),
      );

      manifest[moduleId] = {
        updatedAt: entry.updatedAt ?? null,
      };
    }

    await FileSystem.writeAsStringAsync(
      CACHE_MANIFEST_FILE,
      JSON.stringify(manifest),
    );
  } catch (error) {
    console.warn("[sync] failed to persist content cache", error);
  }
}

function buildDocumentsFromCache(cache: ModuleCache): ContentDocuments | null {
  return buildDocumentsFromSources(cache, null);
}

function buildDocumentsFromSources(
  cache: ModuleCache | null,
  fallbackDocuments: ContentDocuments | null,
): ContentDocuments | null {
  const docs: Partial<Record<ContentModuleId, unknown>> = {};

  for (const id of CONTENT_MODULE_IDS) {
    const cacheEntry = cache?.[id];
    if (cacheEntry) {
      docs[id] = cacheEntry.document;
      continue;
    }

    if (fallbackDocuments) {
      docs[id] = fallbackDocuments[id];
      continue;
    }

    return null;
  }

  try {
    return assertCompleteContentDocuments(docs);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Document application
// ---------------------------------------------------------------------------

function applyDocuments(documents: ContentDocuments) {
  applyContentDocuments(documents);
  applyDataDocuments(documents);
  bumpContentVersion();
}

function debugSyncLog(...args: unknown[]) {
  if (__DEV__ && ENABLE_SYNC_DEBUG_LOGS) {
    console.log(...args);
  }
}

function getBackoffDelayMs(failureCount: number) {
  return Math.min(
    RETRY_BACKOFF_BASE_MS * 2 ** Math.max(0, failureCount - 1),
    RETRY_BACKOFF_MAX_MS,
  );
}

function registerRefreshFailure() {
  consecutiveRefreshFailures += 1;
  const delayMs = getBackoffDelayMs(consecutiveRefreshFailures);
  nextRefreshAllowedAt = Date.now() + delayMs;
  return delayMs;
}

function clearRefreshBackoff() {
  consecutiveRefreshFailures = 0;
  nextRefreshAllowedAt = 0;
}

function getRemainingBackoffMs() {
  return Math.max(0, nextRefreshAllowedAt - Date.now());
}

function logRefreshFailure(context: string, error: unknown) {
  const message = formatSyncError(error);
  const retryInMs = getRemainingBackoffMs();
  const now = Date.now();
  const shouldLog =
    message !== lastFailureMessage ||
    now - lastFailureLoggedAt >= FAILURE_LOG_COOLDOWN_MS;

  if (shouldLog) {
    const retrySuffix =
      retryInMs > 0
        ? ` ستتم إعادة المحاولة خلال ${Math.ceil(retryInMs / 1000)} ثانية.`
        : "";
    console.warn(`[sync] ${message}${retrySuffix}`);
    lastFailureMessage = message;
    lastFailureLoggedAt = now;
  }

  debugSyncLog("[sync] FAILED —", context, message);
}

function clearScheduledRefresh() {
  if (scheduledRefreshHandle) {
    clearTimeout(scheduledRefreshHandle);
    scheduledRefreshHandle = null;
  }
}

function requestRefresh(context: string, delayMs = REFRESH_DEBOUNCE_MS) {
  clearScheduledRefresh();
  const effectiveDelay = Math.max(delayMs, getRemainingBackoffMs());
  scheduledRefreshHandle = setTimeout(() => {
    scheduledRefreshHandle = null;
    void refreshContentFromSupabase().catch((err) =>
      logRefreshFailure(context, err),
    );
  }, effectiveDelay);
}

// ---------------------------------------------------------------------------
// Remote fetch — incremental (timestamps first, then only stale modules)
// ---------------------------------------------------------------------------

async function fetchRemoteDocuments(
  existingCache: ModuleCache,
  onProgress?: (downloaded: number, total: number) => void,
  options: RefreshContentOptions = {},
): Promise<{
  cache: ModuleCache;
  downloadedModuleIds: ContentModuleId[];
  hasChanges: boolean;
}> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase client is unavailable.");

  const config = getSupabaseConfig();
  debugSyncLog("[sync] checking for updates:", config?.url ?? "(none)");

  // ── Step 1: Fetch timestamps only — one tiny request (~200 B compressed) ──
  const { data: timestamps, error: tsError } = await client
    .from("content_modules")
    .select("module_id, updated_at")
    .returns<ContentModuleTimestamp[]>();

  if (tsError) throw tsError;

  const serverTs = new Map<ContentModuleId, string | null>(
    (timestamps ?? []).map((r) => [r.module_id, r.updated_at]),
  );

  // ── Step 2: Identify stale modules ──
  // Compare as normalised ms-since-epoch so timezone-format differences
  // ("Z" vs "+00:00", microsecond truncation, etc.) don't cause false hits.
  function tsMs(ts: string | null | undefined): number {
    if (!ts) return 0;
    const ms = Date.parse(ts);
    return isNaN(ms) ? 0 : ms;
  }

  debugSyncLog("[sync] server timestamps:", JSON.stringify(Object.fromEntries(serverTs)));

  const stale = options.force
    ? [...CONTENT_MODULE_IDS]
    : CONTENT_MODULE_IDS.filter((id) => {
        const cached = existingCache[id];
        const cachedMs = tsMs(cached?.updatedAt);
        const serverMs = tsMs(serverTs.get(id));
        const isStale = !cached || cachedMs !== serverMs;
        debugSyncLog(
          `[sync] ${id}: cached=${cached?.updatedAt ?? "none"} server=${serverTs.get(id) ?? "none"} stale=${isStale}`,
        );
        return isStale;
      });

  if (stale.length === 0) {
    debugSyncLog("[sync] all modules up-to-date — skipping download");
    return { cache: existingCache, downloadedModuleIds: [], hasChanges: false };
  }

  debugSyncLog(
    options.force
      ? `[sync] force refresh requested — downloading all ${stale.length} module(s)`
      : `[sync] ${stale.length} stale module(s): ${stale.join(", ")}`,
  );

  // ── Step 3: Download only the stale modules, one at a time ──
  const updatedCache: ModuleCache = { ...existingCache };
  let fallbackDocuments: ContentDocuments | null = null;
  let downloaded = 0;
  onProgress?.(0, stale.length);

  for (const moduleId of stale) {
    debugSyncLog(`[sync] downloading ${downloaded + 1}/${stale.length}:`, moduleId);

    const { data, error } = await client
      .from("content_modules")
      .select("document")
      .eq("module_id", moduleId)
      .single<ContentModuleRow>();

    if (error) {
      debugSyncLog("[sync] error fetching module:", moduleId, JSON.stringify(error));
      throw error;
    }

    updatedCache[moduleId] = {
      document: sanitizeModuleDocument(moduleId, data.document),
      updatedAt: serverTs.get(moduleId) ?? null,
    };

    await saveModuleCache(updatedCache, [moduleId]);

    if (stale.length === 1 || CMS_MODULE_IDS.includes(moduleId)) {
      const nextDocuments =
        buildDocumentsFromCache(updatedCache) ??
        buildDocumentsFromSources(
          updatedCache,
          fallbackDocuments ?? (fallbackDocuments = getBundledContentDocuments()),
        );

      if (nextDocuments) {
        applyDocuments(nextDocuments);
        initialized = true;
      }
    }

    downloaded++;
    debugSyncLog(`[sync] done ${downloaded}/${stale.length}:`, moduleId);
    onProgress?.(downloaded, stale.length);
  }

  return { cache: updatedCache, downloadedModuleIds: stale, hasChanges: true };
}

async function fetchWithTimeout(
  existingCache: ModuleCache,
  onProgress?: (downloaded: number, total: number) => void,
  options: RefreshContentOptions = {},
): Promise<{
  cache: ModuleCache;
  downloadedModuleIds: ContentModuleId[];
  hasChanges: boolean;
}> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(
            `تعذّر الاتصال بالخادم (انتهت المهلة بعد ${FETCH_TIMEOUT_MS / 1000} ثانية). يُرجى التحقق من الاتصال بالإنترنت.`,
          ),
        ),
      FETCH_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([
      fetchRemoteDocuments(existingCache, onProgress, options),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ---------------------------------------------------------------------------
// Public sync API
// ---------------------------------------------------------------------------

export async function refreshContentFromSupabase(
  options: RefreshContentOptions = {},
) {
  if (options.force) {
    pendingForceRefresh = true;
  }

  if (inFlightRefresh) {
    const result = await inFlightRefresh;
    if (pendingForceRefresh && !result.forced) {
      return refreshContentFromSupabase({ force: true });
    }
    return result;
  }

  const forced = pendingForceRefresh;
  pendingForceRefresh = false;

  inFlightRefresh = (async () => {
    try {
      const existingCache = (await loadModuleCache()) ?? {};
      setSyncProgress(null);

      const {
        cache: updatedCache,
        downloadedModuleIds,
        hasChanges,
      } = await fetchWithTimeout(
        existingCache,
        (downloaded, total) => setSyncProgress({ downloaded, total }),
        { force: forced },
      );

      if (hasChanges) {
        const documents =
          buildDocumentsFromCache(updatedCache) ??
          buildDocumentsFromSources(updatedCache, getBundledContentDocuments());
        if (documents) {
          applyDocuments(documents);
          initialized = true;
        }
      }

      clearRefreshBackoff();

      return {
        downloadedModuleIds,
        forced,
        hasChanges,
      };
    } catch (error) {
      registerRefreshFailure();
      throw error;
    } finally {
      inFlightRefresh = null;
      setSyncProgress(null);
    }
  })();

  // Prevent unhandled-rejection warnings on Hermes while callers can still
  // await and catch the error normally.
  inFlightRefresh.catch(() => {});
  return inFlightRefresh;
}

export function resetContentSync() {
  initialized = false;
  supabaseSyncStarted = false;
  initializationPromise = null;
  inFlightRefresh = null;
  pendingForceRefresh = false;
  clearRefreshBackoff();
  lastFailureMessage = "";
  lastFailureLoggedAt = 0;
  clearScheduledRefresh();
  stopRealtimeSync();
}

export async function initializeContentSync() {
  if (supabaseSyncStarted) {
    if (initializationPromise) await initializationPromise;
    if (initialized) return;
    return;
  }

  supabaseSyncStarted = true;

  if (!initializationPromise) {
    initializationPromise = (async () => {
      // No Supabase config → bundled content is all we have.
      if (!getSupabaseConfig()) {
        const bundled = getBundledContentDocuments();
        applyDocuments(bundled);
        initialized = true;
        return;
      }

      // Apply cached content immediately so the app is usable without waiting
      // for the network, then refresh in the background.
      const cache = await loadModuleCache();
      const cachedDocuments = cache
        ? buildDocumentsFromCache(cache) ??
          buildDocumentsFromSources(cache, getBundledContentDocuments())
        : null;

      if (cachedDocuments) {
        applyDocuments(cachedDocuments);
        initialized = true;
        void refreshContentFromSupabase().catch((err) =>
          logRefreshFailure("Background Supabase refresh failed.", err),
        );
        return;
      }

      // No usable cache yet (first install): apply bundled content so the app
      // has an offline fallback in memory. Give the first remote sync a short
      // setup window to finish, then continue with bundled content if the
      // network is slow or unavailable.
      const bundled = getBundledContentDocuments();
      applyDocuments(bundled);
      initialized = true;

      const initialSync = refreshContentFromSupabase().catch((err) => {
        logRefreshFailure("Initial Supabase refresh failed.", err);
      });

      await Promise.race([initialSync, wait(INITIAL_SYNC_GRACE_MS)]);
    })()
      .catch((error) => {
        supabaseSyncStarted = false;
        throw error;
      })
      .finally(() => {
        initializationPromise = null;
      });
  }

  await initializationPromise;
}

// ---------------------------------------------------------------------------
// Realtime sync
// ---------------------------------------------------------------------------

function handleAppStateChange(nextState: AppStateStatus) {
  if (nextState === "active") {
    requestRefresh("Supabase content refresh on app focus failed.", 0);
  }
}

function startRealtimeSync() {
  if (syncChannel) return;
  const client = getSupabaseClient();
  if (!client) return;

  syncChannel = client
    .channel("content-modules-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "content_modules" },
      () => {
        requestRefresh("Supabase realtime content refresh failed.", 250);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        requestRefresh("Supabase refresh after realtime subscribe failed.", 0);
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        requestRefresh("Supabase realtime fallback refresh failed.", 0);
      }
    });

  appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
  intervalHandle = setInterval(() => {
    requestRefresh("Periodic Supabase content refresh failed.");
  }, POLL_INTERVAL_MS);
}

function stopRealtimeSync() {
  clearScheduledRefresh();
  if (syncChannel && supabaseClient) void supabaseClient.removeChannel(syncChannel);
  syncChannel = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useContentBootstrap() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    error: string | null;
    ready: boolean;
    downloading: boolean;
    syncProgress: SyncProgress;
  }>({
    error: null,
    ready: initialized,
    downloading: false,
    syncProgress: null,
  });

  const retry = useCallback(() => {
    resetContentSync();
    setState({ error: null, ready: false, downloading: false, syncProgress: null });
    setAttempt((n) => n + 1);
  }, []);

  // Subscribe to module-level progress updates (shared across timers / realtime).
  useEffect(() => {
    const notify = () =>
      setState((prev) => ({ ...prev, syncProgress: _syncProgress }));
    _progressListeners.add(notify);
    return () => {
      _progressListeners.delete(notify);
    };
  }, []);

  useEffect(() => {
    let active = true;

    // Show the download screen only when there is no usable cached content.
    void loadModuleCache().then((cache) => {
      if (!active || initialized) return;
      const hasCache =
        cache !== null &&
        (buildDocumentsFromCache(cache) !== null ||
          buildDocumentsFromSources(cache, getBundledContentDocuments()) !== null);
      if (!hasCache) setState((prev) => ({ ...prev, downloading: true }));
    });

    void initializeContentSync()
      .then(() => {
        if (!active) return;
        startRealtimeSync();
        setState((prev) => ({ ...prev, error: null, ready: true, downloading: false }));
      })
      .catch((error) => {
        if (!active) return;
        setState((prev) => ({
          ...prev,
          error: formatSyncError(error),
          ready: false,
          downloading: false,
        }));
      });

    return () => {
      active = false;
      stopRealtimeSync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return { ...state, retry };
}
