-- =============================================================
-- GLÓRIA EM MOVIMENTO — Migração: correções de segurança
-- =============================================================
-- Rode UMA vez no SQL Editor do Supabase, em projetos que já existiam
-- antes desta versão. Projetos novos já recebem tudo pelo schema.sql.
-- Pode ser rodada de novo sem quebrar (usa "drop ... if exists").
--
-- O que muda:
--   1. Usuário não consegue mais se promover a admin (coluna role).
--   2. Telefone e role deixam de ser públicos; nome/foto seguem públicos
--      pela view perfis_publicos.
--   3. Avaliação não pode ser reatribuída a outro usuário (with check explícito).
--   4. Comerciante só propõe comércio (inativo); só admin altera ou apaga.
--   5. A view estabelecimentos_com_media respeita o RLS (não vaza inativos).
--   6. Avatar: só JPG/PNG/WebP, até 2 MB.
--   7. foto_url só aceita https.
--   8. Tabela de limite de uso da Glória IA (contador compartilhado).
-- =============================================================

-- 1 e 2) profiles
drop policy if exists "perfis são visíveis publicamente (nome/foto para avaliações)" on public.profiles;
drop policy if exists "usuário vê o próprio perfil" on public.profiles;
create policy "usuário vê o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "usuário só edita o próprio perfil" on public.profiles;
create policy "usuário só edita o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (nome, foto_url, telefone) on public.profiles to authenticated;

-- ATENÇÃO, de propósito: esta view ignora RLS e expõe só nome e foto.
create or replace view public.perfis_publicos as
  select id, nome, foto_url from public.profiles;
grant select on public.perfis_publicos to anon, authenticated;

-- 7) foto_url https
alter table public.profiles drop constraint if exists profiles_foto_url_https;
alter table public.profiles
  add constraint profiles_foto_url_https
  check (foto_url is null or foto_url like 'https://%') not valid;

-- 3) avaliacoes
drop policy if exists "usuário edita ou apaga só a própria avaliação" on public.avaliacoes;
drop policy if exists "usuário edita só a própria avaliação" on public.avaliacoes;
create policy "usuário edita só a própria avaliação"
  on public.avaliacoes for update
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

-- 4) estabelecimentos
drop policy if exists "só admin ou comerciante dono gerencia estabelecimentos" on public.estabelecimentos;
drop policy if exists "admin cria estabelecimento" on public.estabelecimentos;
drop policy if exists "comerciante propõe estabelecimento inativo" on public.estabelecimentos;
drop policy if exists "só admin altera estabelecimento" on public.estabelecimentos;
drop policy if exists "só admin apaga estabelecimento" on public.estabelecimentos;

create policy "admin cria estabelecimento"
  on public.estabelecimentos for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "comerciante propõe estabelecimento inativo"
  on public.estabelecimentos for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'comerciante')
    and criado_por = auth.uid()
    and ativo = false
  );

create policy "só admin altera estabelecimento"
  on public.estabelecimentos for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "só admin apaga estabelecimento"
  on public.estabelecimentos for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 5) view respeitando RLS de quem consulta
alter view public.estabelecimentos_com_media set (security_invoker = true);

-- 6) avatar: tipo e tamanho
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
    file_size_limit = 2097152
where id = 'avatars';

-- 8) limite de uso da Glória IA
create table if not exists public.rate_limits (
  ip_hash text primary key,
  janela timestamptz not null,
  contador int not null default 0
);
create index if not exists idx_rate_limits_janela on public.rate_limits (janela);
alter table public.rate_limits enable row level security;

create or replace function public.consumir_limite_ia(p_ip_hash text, p_maximo int, p_janela_segundos int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contador int;
begin
  if p_ip_hash is null or length(p_ip_hash) > 128 or p_maximo < 1 or p_janela_segundos < 1 then
    return false;
  end if;

  delete from public.rate_limits where janela < now() - interval '1 day';

  insert into public.rate_limits as r (ip_hash, janela, contador)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update set
    janela   = case when r.janela < now() - make_interval(secs => p_janela_segundos) then now() else r.janela end,
    contador = case when r.janela < now() - make_interval(secs => p_janela_segundos) then 1 else r.contador + 1 end
  returning contador into v_contador;

  return v_contador <= p_maximo;
end;
$$;

revoke all on function public.consumir_limite_ia(text, int, int) from public;
grant execute on function public.consumir_limite_ia(text, int, int) to anon, authenticated;
