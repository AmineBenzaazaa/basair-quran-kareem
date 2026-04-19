#!/usr/bin/env node
/**
 * Script to push correct 7 rules to Supabase
 * Run: node scripts/push-rules-to-supabase.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', 'dashboard', '.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const { createClient } = require('@supabase/supabase-js');

// Load correct rules data
const rulesData = require('../dashboard/src/lib/content/seeds/rules-article.json');

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in environment');
    console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📤 Pushing correct rules to Supabase...');
  console.log('📊 Sections count:', rulesData.sections.length);
  rulesData.sections.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.heading}`);
  });

  const { data, error } = await supabase
    .from('content_modules')
    .upsert(
      {
        module_id: 'rules-article',
        document: rulesData,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'module_id',
      }
    );

  if (error) {
    console.error('❌ Error pushing to Supabase:', error.message);
    process.exit(1);
  }

  console.log('✅ Successfully pushed 7 rules to Supabase!');
  console.log('🔄 Please refresh the dashboard to see the changes.');
}

main().catch(console.error);
