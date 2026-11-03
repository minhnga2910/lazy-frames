#!/usr/bin/env node
/**
 * Sync the plugin registry into Supabase (table `public.plugins`).
 *
 * Source of truth remains `plugins/<id>/manifest.json`; the CLI builds
 * `docs/plugins/index.json` from it. This script upserts that registry into
 * Supabase so the web marketplace can read it live (with static fallback).
 *
 * Usage (service-role key is a secret — never commit it):
 *   SUPABASE_URL="https://<ref>.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="<service-role key>" \
 *   npm run plugins:sync-supabase
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(path.join(root, 'docs/plugins/index.json'), 'utf8'));

const rows = registry.plugins.map((p) => ({
  id: p.id,
  name: p.name,
  version: p.version,
  description: p.description,
  category: p.category,
  status: p.status,
  is_default: Boolean(p.default),
  featured: Boolean(p.featured),
  installable: Boolean(p.installable),
  provider_name: p.provider?.name ?? null,
  provider_url: p.provider?.url ?? null,
  publisher_name: p.publisher?.name ?? null,
  tags: p.tags ?? [],
  capabilities: p.capabilities ?? [],
  manifest: p,
  updated_at: new Date().toISOString(),
}));

const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/plugins?on_conflict=id`, {
  method: 'POST',
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
});

if (!res.ok) {
  console.error(`Supabase upsert failed: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}

console.log(`Synced ${rows.length} plugins to Supabase (${url}).`);
