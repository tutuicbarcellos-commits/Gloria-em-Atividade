-- =============================================================
-- GLÓRIA EM MOVIMENTO — Complemento 2: Storage (fotos de perfil)
--                                        + como virar admin
-- =============================================================
-- Rode isto DEPOIS do schema.sql, também no SQL Editor do Supabase.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Bucket "avatars" para fotos de perfil
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('avatars', 'avatars', true, array['image/jpeg', 'image/png', 'image/webp'], 2097152)
on conflict (id) do update set
  allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit = excluded.file_size_limit;

-- Qualquer pessoa pode VER as fotos (bucket público — é só a foto de perfil)
create policy "avatares são públicos para leitura"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Só o dono pode enviar/atualizar/apagar a própria foto.
-- Convenção de nome de arquivo usada pelo app: "<uid-do-usuario>/foto.jpg"
-- — por isso a política checa se o 1º pedaço do caminho é o próprio uid.
create policy "usuário só envia a própria foto"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "usuário só atualiza a própria foto"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "usuário só apaga a própria foto"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- -------------------------------------------------------------
-- 2) Como promover seu usuário a administrador
-- -------------------------------------------------------------
-- 1. Cadastre-se normalmente pelo site (Entrar → Criar conta).
-- 2. Rode o comando abaixo, TROCANDO o e-mail pelo que você usou:
--
--   update public.profiles
--   set role = 'admin'
--   where id = (select id from auth.users where email = 'SEU-EMAIL-AQUI@exemplo.com');
--
-- 3. Saia e entre de novo no site (ou dê F5) para o perfil recarregar
--    com o novo cargo. O link "Painel admin" aparece no menu quando
--    role = 'admin'.

-- -------------------------------------------------------------
-- 3) "Desativei a confirmação de e-mail, mas ainda não consigo entrar"
-- -------------------------------------------------------------
-- Causa comum: desativar "Confirm email" no painel só vale para contas
-- CRIADAS DEPOIS da mudança. Contas de teste criadas ANTES continuam
-- marcadas como não confirmadas e continuam bloqueadas.
--
-- Rode o comando abaixo para confirmar manualmente TODAS as contas que
-- ainda estão pendentes (seguro rodar mais de uma vez):
--
--   update auth.users
--   set email_confirmed_at = now()
--   where email_confirmed_at is null;
--
-- Depois disso, o login com e-mail/senha dessas contas passa a funcionar
-- imediatamente.
