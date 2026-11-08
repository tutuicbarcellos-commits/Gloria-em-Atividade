-- =============================================================
-- GLÓRIA EM MOVIMENTO — Migração: campo de site (website)
-- Rode isto no SQL Editor (seguro rodar mesmo se já rodou antes).
-- =============================================================
alter table public.estabelecimentos
  add column if not exists website text;
