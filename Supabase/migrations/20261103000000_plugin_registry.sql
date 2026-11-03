-- Lazy Frames plugin registry on Supabase.
-- Source of truth stays plugins/<id>/manifest.json; this table mirrors the
-- generated registry (docs/plugins/index.json) for the web marketplace.
-- Public read-only (RLS); writes only via service role / sync script.
create table if not exists public.plugins (
  id text primary key,
  name text not null,
  version text not null,
  description text not null,
  category text not null,
  status text not null,
  is_default boolean not null default false,
  featured boolean not null default false,
  installable boolean not null default true,
  provider_name text,
  provider_url text,
  publisher_name text,
  tags text[] not null default '{}',
  capabilities text[] not null default '{}',
  manifest jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists plugins_category_idx on public.plugins (category);
create index if not exists plugins_status_idx on public.plugins (status);
alter table public.plugins enable row level security;
drop policy if exists "plugins are publicly readable" on public.plugins;
create policy "plugins are publicly readable" on public.plugins
  for select to anon, authenticated using (true);
comment on table public.plugins is 'Lazy Frames plugin registry — mirrors plugins/<id>/manifest.json; public read-only, writes via service role only.';
