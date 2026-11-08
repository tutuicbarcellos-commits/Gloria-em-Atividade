-- =============================================================
-- GLÓRIA EM MOVIMENTO — Verificação das correções de segurança
-- =============================================================
-- Rode no SQL Editor depois de schema.sql (ou migracao-seguranca.sql).
-- Se alguma checagem falhar, aparece uma exceção com a descrição.
-- Se tudo passar, aparece "OK" na aba de mensagens.
-- =============================================================
do $$
begin
  -- 1) usuário autenticado não altera role
  if has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') then
    raise exception 'FALHA: authenticated pode alterar profiles.role';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'nome', 'UPDATE') then
    raise exception 'FALHA: authenticated não consegue alterar profiles.nome';
  end if;

  -- 2) profiles não tem leitura pública
  if exists (select 1 from pg_policies
             where schemaname = 'public' and tablename = 'profiles'
               and cmd = 'SELECT' and qual = 'true') then
    raise exception 'FALHA: profiles ainda tem SELECT público (using true)';
  end if;

  -- 3) avaliacoes: UPDATE com with check
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'avaliacoes'
                   and cmd = 'UPDATE' and with_check is not null) then
    raise exception 'FALHA: avaliacoes UPDATE sem with check';
  end if;

  -- 4) estabelecimentos: nada de policy "ALL"; UPDATE/DELETE só admin
  if exists (select 1 from pg_policies
             where schemaname = 'public' and tablename = 'estabelecimentos' and cmd = 'ALL') then
    raise exception 'FALHA: estabelecimentos ainda tem policy FOR ALL';
  end if;

  -- 5) view respeita RLS de quem consulta
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'estabelecimentos_com_media'
                   and c.reloptions @> array['security_invoker=true']) then
    raise exception 'FALHA: estabelecimentos_com_media sem security_invoker';
  end if;

  -- 6) avatar restrito a imagens
  if not exists (select 1 from storage.buckets
                 where id = 'avatars'
                   and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']) then
    raise exception 'FALHA: bucket avatars aceita tipos além de JPG/PNG/WebP';
  end if;

  -- 7) rate limit: tabela com RLS ligado
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'rate_limits' and c.relrowsecurity) then
    raise exception 'FALHA: rate_limits sem RLS';
  end if;

  raise notice 'OK: todas as verificações de segurança passaram';
end $$;
