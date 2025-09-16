# DumbGoodies

Generate dumb merch images from your logo or brand name with AI competition mode.

## Features

- **AI Competition Mode**: Compare Seedream 4.0 vs OpenAI gpt-image-1 side-by-side
- **Auto-propose Ideas**: Generate 2 dumb product concepts automatically
- **Smart Logo Placement**: Intelligent branding with proper perspective
- **Download & Gallery**: Save renders and browse public gallery

## Setup

### 1. Environment Variables

Create `.env.local` with:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# OpenAI (required for gpt-image-1 edit and idea generation)
OPENAI_API_KEY=sk-...

# Replicate (required for Seedream 4.0)
REPLICATE_API_TOKEN=r8_...
REPLICATE_MODEL=bytedance/seedream-4

# Supabase (required for storage and database)
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...
```

### 2. Supabase Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Create tables
create table if not exists public.dumbgoodies_projects (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  logo_url text,
  product_hint text,
  product_ref_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.dumbgoodies_concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.dumbgoodies_projects(id) on delete cascade,
  label text not null,
  prompt_base text not null,
  status text not null default 'idea' check (status in ('idea','rendered')),
  created_at timestamptz not null default now()
);

create table if not exists public.dumbgoodies_renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.dumbgoodies_projects(id) on delete cascade,
  concept_id uuid not null references public.dumbgoodies_concepts(id) on delete cascade,
  model text not null check (model in ('v1-seedream','v1_5-openai')),
  image_url text not null,
  thumbnail_url text,
  public boolean not null default true,
  created_at timestamptz not null default now()
);

-- Create storage buckets
insert into storage.buckets (id, name, public) values
  ('dumbgoodies_uploads', 'dumbgoodies_uploads', true),
  ('dumbgoodies_renders', 'dumbgoodies_renders', true),
  ('dumbgoodies_thumbs',  'dumbgoodies_thumbs',  true)
on conflict (id) do nothing;
```

### 3. Run Development Server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start creating dumb goodies!

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **AI**: Seedream 4.0 (via Replicate), OpenAI gpt-image-1
- **Storage**: Supabase (Postgres + Storage)
- **Image Processing**: Sharp
- **Deploy**: Vercel
