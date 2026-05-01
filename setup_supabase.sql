-- Script de Setup para o Banco de Dados no Supabase

-- Habilitar a extensão pgvector para a Wiki Técnica (IA)
create extension if not exists vector;

-- Tabela de Leads (Capturados via Landing Page)
create table if not exists public.leads (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default now(),
    name text not null,
    whatsapp text not null,
    service_category text not null,
    message text,
    urgency text default 'Média',
    client_type text default 'Pessoa Física',
    status text default 'Novo'
);

-- Tabela de Clientes (Leads convertidos ou cadastros diretos)
create table if not exists public.customers (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default now(),
    name text not null,
    whatsapp text unique not null,
    client_type text default 'Pessoa Física',
    notes text
);

-- Tabela de Reparos / Ordens de Serviço
create table if not exists public.repairs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default now(),
    customer_id uuid references public.customers(id),
    device_model text not null,
    description text,
    status text default 'Em Análise',
    price numeric default 0,
    part_cost numeric default 0,
    price_total numeric generated always as (price) stored, -- Simplificado
    exit_date date
);

-- Tabela de Inventário (Produtos em estoque)
create table if not exists public.products (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default now(),
    name text not null,
    description text,
    category text,
    stock_quantity integer default 0,
    cost_price numeric default 0,
    price numeric default 0,
    is_active boolean default true
);

-- Tabela Wiki (Cérebro da IA para resoluções técnicas)
create table if not exists public.wiki (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default now(),
    title text not null,
    category text,
    content text,
    embedding vector(384), -- Ajustado para o modelo Xenova/all-MiniLM-L6-v2
    success_score integer default 0
);

-- Habilitar RLS (Row Level Security) - Opcional, mas recomendado
-- Por enquanto, as chaves anon/service_role são usadas conforme config.js

-- Função para busca semântica na Wiki (usada pelo admin.js futuramente)
create or replace function match_wiki (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  title text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    wiki.id,
    wiki.title,
    wiki.content,
    1 - (wiki.embedding <=> query_embedding) as similarity
  from wiki
  where 1 - (wiki.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
