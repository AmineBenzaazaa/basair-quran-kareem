import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

config({ path: path.join(ROOT_DIR, ".env") });

const MODULES = [
  ["intro", "assets/content copy/intro.json"],
  ["concepts", "assets/content copy/concepts.json"],
  ["rules-article", "assets/content copy/rules.json"],
  ["method-flow", "assets/content copy/method.json"],
  ["method-sections", "src/data/content/method.json"],
  ["glossary", "src/data/content/glossary.json"],
  ["surahs", "assets/content copy/surahs.json"],
  ["ayahs", "assets/content copy/ayahs.json"],
  ["tafsir", "assets/content copy/tafsir.json"],
  ["verses-tokens", "dashboard/src/lib/content/seeds/verses-tokens.json"],
];

function getEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

async function main() {
  const url =
    getEnv("SUPABASE_URL") ||
    getEnv("EXPO_PUBLIC_SUPABASE_URL") ||
    getEnv("VITE_SUPABASE_URL");
  const serviceRoleKey =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_ROLE");

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env. Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL/VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const timestamp = new Date().toISOString();
  const rows = await Promise.all(
    MODULES.map(async ([moduleId, relativePath]) => {
      const absolutePath = path.join(ROOT_DIR, relativePath);
      const raw = await fs.readFile(absolutePath, "utf8");
      return {
        module_id: moduleId,
        document: JSON.parse(raw),
        updated_at: timestamp,
      };
    })
  );

  const { error } = await client.from("content_modules").upsert(rows, {
    onConflict: "module_id",
  });

  if (error) {
    throw error;
  }

  console.log(`Upserted ${rows.length} content modules to Supabase.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
