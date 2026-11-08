-- =============================================================
-- GLÓRIA EM MOVIMENTO — Migração: solicitações de novos comércios
-- =============================================================
-- Rode UMA vez no SQL Editor do Supabase (projetos que já existem).
-- Pode ser rodada de novo sem quebrar (usa "if not exists" / "drop ... if exists").
--
-- O que muda:
--   1. Nova tabela `solicitacoes_estabelecimento`: qualquer pessoa (inclusive
--      sem conta) pode SUGERIR um comércio pelo site. A sugestão nunca aparece
--      no mapa sozinha: fica "pendente" até o admin aprovar ou recusar.
--   2. Funções `aprovar_solicitacao` e `recusar_solicitacao`: só admin consegue
--      executá-las (checagem dentro do banco, não só no site). Aprovar cria o
--      comércio já ativo, com as coordenadas que o admin informar.
--   3. Proteção básica contra spam: limites de tamanho nos campos, campo de
--      armadilha no formulário (feito no site) e um teto global de envios por hora.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Tabela de solicitações
-- -------------------------------------------------------------
create table if not exists public.solicitacoes_estabelecimento (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  categoria_id text not null references public.categorias (id),
  endereco text not null check (char_length(endereco) between 5 and 200),
  telefone text check (telefone is null or char_length(telefone) <= 40),
  horario text check (horario is null or char_length(horario) <= 200),
  site text check (site is null or char_length(site) <= 200),
  descricao text check (descricao is null or char_length(descricao) <= 500),
  -- Quem sugeriu (opcional). Nunca é exibido publicamente.
  nome_solicitante text check (nome_solicitante is null or char_length(nome_solicitante) <= 120),
  contato_solicitante text check (contato_solicitante is null or char_length(contato_solicitante) <= 120),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  estabelecimento_id uuid references public.estabelecimentos (id) on delete set null,
  criado_em timestamptz not null default now(),
  respondido_em timestamptz
);

create index if not exists idx_solicitacoes_status on public.solicitacoes_estabelecimento (status, criado_em desc);

alter table public.solicitacoes_estabelecimento enable row level security;

-- Qualquer pessoa pode ENVIAR uma sugestão, mas só como "pendente" e sem
-- já vir ligada a um comércio. Não consegue ler nem alterar as sugestões dos outros.
drop policy if exists "qualquer um pode sugerir comércio" on public.solicitacoes_estabelecimento;
create policy "qualquer um pode sugerir comércio"
  on public.solicitacoes_estabelecimento for insert
  to anon, authenticated
  with check (
    status = 'pendente'
    and estabelecimento_id is null
    and respondido_em is null
  );

-- Só admin lê, altera e apaga as solicitações.
drop policy if exists "só admin lê solicitações" on public.solicitacoes_estabelecimento;
create policy "só admin lê solicitações"
  on public.solicitacoes_estabelecimento for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "só admin apaga solicitações" on public.solicitacoes_estabelecimento;
create policy "só admin apaga solicitações"
  on public.solicitacoes_estabelecimento for delete
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

revoke all on public.solicitacoes_estabelecimento from anon, authenticated;
grant insert on public.solicitacoes_estabelecimento to anon, authenticated;
grant select, delete on public.solicitacoes_estabelecimento to authenticated;

-- Teto global de envios por hora (contra robôs). Ajuste o número se precisar.
create or replace function public.limitar_envios_solicitacoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.solicitacoes_estabelecimento
      where criado_em > now() - interval '1 hour') >= 30 then
    raise exception 'Muitas sugestões em pouco tempo. Tente de novo mais tarde.';
  end if;
  return new;
end;
$$;

drop trigger if exists antes_de_sugerir on public.solicitacoes_estabelecimento;
create trigger antes_de_sugerir
  before insert on public.solicitacoes_estabelecimento
  for each row execute function public.limitar_envios_solicitacoes();

-- -------------------------------------------------------------
-- 2) Aprovar / recusar (somente admin)
-- -------------------------------------------------------------
-- Aprovar: cria o comércio no mapa (ativo) a partir da sugestão e marca a
-- sugestão como aprovada. Tudo numa transação só.
create or replace function public.aprovar_solicitacao(
  p_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_nome text default null,
  p_categoria_id text default null,
  p_endereco text default null,
  p_telefone text default null,
  p_horario text default null,
  p_site text default null,
  p_descricao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitacao public.solicitacoes_estabelecimento%rowtype;
  v_novo_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Apenas administradores podem aprovar solicitações.';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Coordenadas inválidas.';
  end if;

  select * into v_solicitacao from public.solicitacoes_estabelecimento where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;
  if v_solicitacao.status <> 'pendente' then
    raise exception 'Esta solicitação já foi respondida.';
  end if;

  -- O admin pode corrigir os dados antes de aprovar (valores nulos = usa o original).
  insert into public.estabelecimentos
    (nome, categoria_id, endereco, telefone, horario, website, descricao, latitude, longitude, ativo, criado_por)
  values (
    coalesce(nullif(trim(p_nome), ''), v_solicitacao.nome),
    coalesce(nullif(trim(p_categoria_id), ''), v_solicitacao.categoria_id),
    coalesce(nullif(trim(p_endereco), ''), v_solicitacao.endereco),
    coalesce(nullif(trim(p_telefone), ''), v_solicitacao.telefone),
    coalesce(nullif(trim(p_horario), ''), v_solicitacao.horario),
    coalesce(nullif(trim(p_site), ''), v_solicitacao.site),
    coalesce(nullif(trim(p_descricao), ''), v_solicitacao.descricao),
    p_latitude,
    p_longitude,
    true,
    auth.uid()
  )
  returning id into v_novo_id;

  update public.solicitacoes_estabelecimento
  set status = 'aprovada', estabelecimento_id = v_novo_id, respondido_em = now()
  where id = p_id;

  return v_novo_id;
end;
$$;

-- Recusar: só marca a solicitação. Não cria nada no mapa.
create or replace function public.recusar_solicitacao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Apenas administradores podem recusar solicitações.';
  end if;

  update public.solicitacoes_estabelecimento
  set status = 'recusada', respondido_em = now()
  where id = p_id and status = 'pendente';
end;
$$;

revoke all on function public.aprovar_solicitacao(uuid, double precision, double precision, text, text, text, text, text, text, text) from public;
revoke all on function public.recusar_solicitacao(uuid) from public;
grant execute on function public.aprovar_solicitacao(uuid, double precision, double precision, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.recusar_solicitacao(uuid) to authenticated;
