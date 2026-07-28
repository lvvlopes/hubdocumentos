-- ── Schema do AI News Hub (Supabase / Postgres) ──────────────────
-- Rode este script no Supabase: SQL Editor → New query → Run.

-- Notícias coletadas
create table if not exists articles (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  category   text not null check (category in ('ia','dev','projetos')),
  title      text not null,
  summary    text,
  source     text,
  url        text not null,
  tags       jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  -- deduplicação: a mesma URL não se repete dentro da categoria
  unique (category, url)
);

create index if not exists idx_articles_date on articles (date desc);
create index if not exists idx_articles_cat  on articles (category);

-- Posts publicados no Instagram
create table if not exists instagram_posts (
  id           uuid primary key default gen_random_uuid(),
  article_id   uuid references articles (id) on delete set null,
  category     text,
  image_url    text not null,
  caption      text,
  ig_post_id   text,
  published_at timestamptz not null default now()
);

create index if not exists idx_igposts_pub on instagram_posts (published_at desc);

-- ── Storage ──────────────────────────────────────────────────────
-- Crie um bucket PÚBLICO chamado "ig-images":
--   Storage → New bucket → name: ig-images → marque "Public bucket".
-- O Instagram exige URL pública para a imagem; o bucket público entrega isso.
