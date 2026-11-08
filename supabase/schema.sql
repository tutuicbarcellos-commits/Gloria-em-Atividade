-- =============================================================
-- GLÓRIA EM MOVIMENTO — Schema do banco de dados (Supabase/Postgres)
-- =============================================================
-- Como usar: Supabase → seu projeto → SQL Editor → New query →
-- cole este arquivo inteiro → Run. Ele cria as tabelas, os índices,
-- as políticas de segurança (RLS) e popula categorias + os
-- estabelecimentos reais do bairro Glória já levantados.
--
-- Regra geral de segurança usada aqui (RLS = Row Level Security):
-- cada tabela só permite que o Postgres execute uma operação
-- (select/insert/update/delete) se a linha específica passar numa
-- condição — isso substitui checagens de segurança que, num backend
-- tradicional, ficariam espalhadas pelo código do servidor.
-- =============================================================

-- -------------------------------------------------------------
-- 1) PERFIS (estende auth.users, que o Supabase já gerencia)
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default 'Usuário',
  foto_url text,
  telefone text,
  role text not null default 'usuario' check (role in ('usuario', 'comerciante', 'admin')),
  criado_em timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuário lê só a própria linha (inclui telefone e role).
create policy "usuário vê o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "usuário só edita o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Colunas que o usuário pode alterar pelo site. "role" fica de fora de
-- propósito: quem muda o papel de alguém é o admin, pelo SQL Editor.
revoke update on public.profiles from authenticated;
grant update (nome, foto_url, telefone) on public.profiles to authenticated;

-- Dados públicos de perfil (só nome e foto), para exibir quem fez uma avaliação.
-- ATENÇÃO, de propósito: esta view roda com o privilégio do dono e ignora RLS.
-- Ela expõe apenas as três colunas listadas. Não adicione telefone ou role aqui.
create or replace view public.perfis_publicos as
  select id, nome, foto_url from public.profiles;
grant select on public.perfis_publicos to anon, authenticated;

-- Garante que a foto de perfil seja um link https (nunca javascript:, data: etc.).
-- "not valid" não bloqueia dados antigos; novas linhas são sempre checadas.
alter table public.profiles
  add constraint profiles_foto_url_https
  check (foto_url is null or foto_url like 'https://%') not valid;

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.criar_perfil_ao_cadastrar()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_ao_cadastrar();

-- -------------------------------------------------------------
-- 2) CATEGORIAS
-- -------------------------------------------------------------
create table if not exists public.categorias (
  id text primary key,
  nome text not null,
  cor text not null,
  cor_bg text not null,
  ordem int not null default 0
);

alter table public.categorias enable row level security;

create policy "categorias são públicas para leitura"
  on public.categorias for select using (true);

create policy "só admin gerencia categorias"
  on public.categorias for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- -------------------------------------------------------------
-- 3) ESTABELECIMENTOS
-- -------------------------------------------------------------
create table if not exists public.estabelecimentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id text not null references public.categorias (id),
  endereco text not null,
  telefone text,
  latitude double precision not null,
  longitude double precision not null,
  horario text,
  foto_url text,
  descricao text,
  website text,
  -- Nota/contagem importadas do Google Maps no momento do cadastro inicial —
  -- é um valor de referência, DIFERENTE das avaliações feitas dentro do app
  -- (tabela `avaliacoes` abaixo), que são as avaliações reais dos usuários.
  nota_google numeric(2,1),
  avaliacoes_google int,
  ativo boolean not null default true,
  criado_por uuid references public.profiles (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_estabelecimentos_categoria on public.estabelecimentos (categoria_id);
create index if not exists idx_estabelecimentos_ativo on public.estabelecimentos (ativo);

alter table public.estabelecimentos enable row level security;

create policy "estabelecimentos ativos são públicos para leitura"
  on public.estabelecimentos for select
  using (ativo = true or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Quem publica o catálogo é o admin. Um comerciante só pode PROPOR um comércio,
-- e ele entra inativo (ativo = false) até um admin aprovar.
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

-- Decisão de segurança: comerciante NÃO edita nem apaga o cadastro depois de criado.
create policy "só admin altera estabelecimento"
  on public.estabelecimentos for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "só admin apaga estabelecimento"
  on public.estabelecimentos for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- -------------------------------------------------------------
-- 4) AVALIAÇÕES (feitas pelos usuários dentro do app)
-- -------------------------------------------------------------
create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  nota smallint not null check (nota between 1 and 5),
  comentario text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (estabelecimento_id, usuario_id) -- 1 avaliação por usuário por estabelecimento (evita duplicidade)
);

create index if not exists idx_avaliacoes_estabelecimento on public.avaliacoes (estabelecimento_id);

alter table public.avaliacoes enable row level security;

create policy "avaliações são públicas para leitura"
  on public.avaliacoes for select using (true);

create policy "usuário logado cria sua própria avaliação"
  on public.avaliacoes for insert
  with check (auth.uid() = usuario_id);

create policy "usuário edita só a própria avaliação"
  on public.avaliacoes for update
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

create policy "usuário apaga só a própria avaliação"
  on public.avaliacoes for delete using (auth.uid() = usuario_id);

-- View com a média e o total calculados a partir das avaliações reais do app
-- security_invoker: a view respeita o RLS de quem consulta (sem isso ela
-- ignora RLS e expõe estabelecimentos inativos).
create or replace view public.estabelecimentos_com_media
with (security_invoker = true) as
select
  e.*,
  coalesce(round(avg(a.nota)::numeric, 1), e.nota_google) as nota_media,
  coalesce(count(a.id), 0) as total_avaliacoes_app
from public.estabelecimentos e
left join public.avaliacoes a on a.estabelecimento_id = e.id
group by e.id;

-- -------------------------------------------------------------
-- 5) FAVORITOS
-- -------------------------------------------------------------
create table if not exists public.favoritos (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  estabelecimento_id uuid not null references public.estabelecimentos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (usuario_id, estabelecimento_id)
);

alter table public.favoritos enable row level security;

create policy "usuário só vê/gerencia os próprios favoritos"
  on public.favoritos for all
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

-- -------------------------------------------------------------
-- 6) HISTÓRICO (buscas e visitas)
-- -------------------------------------------------------------
create table if not exists public.historico (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  estabelecimento_id uuid references public.estabelecimentos (id) on delete set null,
  termo_busca text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_historico_usuario on public.historico (usuario_id, criado_em desc);

alter table public.historico enable row level security;

create policy "usuário só vê/gerencia o próprio histórico"
  on public.historico for all
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

-- =============================================================
-- SEED: categorias e os estabelecimentos reais do bairro Glória
-- (mesmos dados já levantados via Google Maps nesta conversa)
-- =============================================================
insert into public.categorias (id, nome, cor, cor_bg, ordem) values
  ('farmacias', 'Farmácias', '#16A34A', '#E9F9EE', 1),
  ('mercados', 'Mercados', '#2F6FEE', '#EAF1FF', 2),
  ('restaurantes', 'Restaurantes', '#F97316', '#FFF1E6', 3),
  ('padarias', 'Padarias', '#B45309', '#FDF1DE', 4),
  ('academias', 'Academias', '#8B5CF6', '#F1ECFE', 5),
  ('petshops', 'Pet Shops', '#EAB308', '#FEF9E7', 6),
  ('bancos', 'Bancos', '#0EA5A4', '#E6F8F7', 7),
  ('loterias', 'Loterias', '#7C3AED', '#F1ECFE', 8),
  ('oficinas', 'Oficinas', '#2563EB', '#E9EFFE', 9),
  ('clinicas', 'Clínicas', '#16A34A', '#E9F9EE', 10),
  ('escolas', 'Escolas', '#2F6FEE', '#EAF1FF', 11),
  ('lojas', 'Lojas', '#F97316', '#FFF1E6', 12)
on conflict (id) do nothing;

insert into public.estabelecimentos (nome, categoria_id, endereco, telefone, latitude, longitude, horario, nota_google, avaliacoes_google) values
  ('Farmácia São João (Oscar Pereira)', 'farmacias', 'Av. Prof. Oscar Pereira, 2979', '+55 54 99709-5513', -30.0762644, -51.2012569, 'Seg a Sáb 7h30–22h · Dom 8h–21h', 2.5, 31),
  ('São João (Cel. Aparício Borges)', 'farmacias', 'R. Cel. Aparício Borges, 888', '+55 54 99695-4036', -30.0731538, -51.1994706, 'Seg a Sáb 7h–23h · Dom 8h–22h', 3.8, 93),
  ('R&C Farma', 'farmacias', 'Av. Prof. Oscar Pereira, 2928', '+55 51 3315-6150', -30.0758293, -51.2009804, 'Seg a Sáb, 8h–20h · Dom fechado', 5.0, 25),
  ('Panvel Farmácias', 'farmacias', 'Av. Prof. Oscar Pereira, 2679', '+55 51 3218-9000', -30.073985, -51.2029582, 'Seg a Sáb 7h–23h · Dom 8h–22h', 4.4, 210),
  ('Super Glória', 'mercados', 'R. Pedro Boticário, 493', '+55 51 3315-7051', -30.0730822, -51.1999897, 'Seg a Sáb 7h30–21h · Dom 8h–13h', 4.5, 1197),
  ('Anuar Pezzi Supermercados – Glória', 'mercados', 'Av. Prof. Oscar Pereira, 2925', '+55 51 3086-5408', -30.0759842, -51.2017668, 'Seg a Sáb 7h–22h · Dom 7h30–21h', 4.4, 585),
  ('Supermercado Maccari', 'mercados', 'Av. Prof. Oscar Pereira, 2993', '+55 51 3339-1640', -30.07655, -51.201074, 'Seg a Sáb, 7h30–21h · Dom fechado', 4.4, 3100),
  ('Super Anuar Pezzi', 'mercados', 'Av. Prof. Oscar Pereira, 2185', '+55 51 3093-3087', -30.0697622, -51.2048869, 'Seg a Sáb 7h–22h · Dom 7h30–21h', 4.1, 2043),
  ('Supermercado Lazzari', 'mercados', 'R. São Joaquim, 201', '+55 51 3336-3009', -30.072138, -51.206451, 'Seg a Sáb 7h30–12h e 14h–20h · Dom fechado', 4.6, 580),
  ('Glória Restaurante', 'restaurantes', 'R. Pedro Boticário, 483', '+55 51 3384-5509', -30.0730263, -51.2001922, 'Seg a Sáb, 11h–14h30 · Dom fechado', 4.5, 382),
  ('Restaurante e Lancheria Veneza', 'restaurantes', 'Av. Prof. Oscar Pereira, 2397', '+55 51 3336-0609', -30.0715037, -51.2041259, 'Seg a Sex 7h–19h · Sáb 7h–17h · Dom fechado', 4.4, 79),
  ('Pastel do Glória', 'restaurantes', 'R. Manduca Nunes, 160', '+55 53 99131-2445', -30.0762235, -51.1936944, 'Ter a Dom, tardinha–23h30 · Seg fechado', 5.0, 37),
  ('Restaurante Campeirinho', 'restaurantes', 'Av. Prof. Oscar Pereira, 2619', '+55 51 3318-3421', -30.0734649, -51.2031972, 'Seg a Sáb, 10h–15h · Dom fechado', 3.8, 92),
  ('Feito em Casa Fast Food', 'restaurantes', 'Av. Prof. Oscar Pereira, 2256', '+55 51 99391-1952', -30.0703287, -51.204337, 'Todos os dias, 11h30–13h30 e 19h–23h30', 4.2, 6),
  ('Padaria Glória', 'padarias', 'R. Me. Ana, 291', '+55 51 3336-9099', -30.0788283, -51.198697, 'Todos os dias, 6h30–21h30', 4.3, 1538),
  ('Academia 26fit – Aparício', 'academias', 'R. Cel. Aparício Borges, 1640', '+55 51 99662-5114', -30.0716919, -51.1918527, 'Seg a Sex 5h–23h · Sáb 9h–17h · Dom 9h–13h', 4.1, 159),
  ('Moinhos Fitness Gym', 'academias', 'R. Cel. Aparício Borges, 250', '+55 51 98162-0069', -30.07531, -51.2052373, 'Seg a Sex 5h30–23h · Sáb 8h–20h · Dom 10h–19h', 4.0, 451),
  ('Pet 3i', 'petshops', 'Av. Prof. Oscar Pereira, 2121', '+55 51 99210-2801', -30.0691463, -51.2051471, 'Seg a Sáb 9h–20h · Dom 9h–13h', 4.8, 21),
  ('Pet Shop Agrovillari', 'petshops', 'R. Cel. Aparício Borges, 888', '+55 51 3273-2394', -30.0731538, -51.1994706, 'Seg a Sex 9h–20h · Sáb 9h–18h · Dom fechado', 4.8, 487),
  ('Divino Pelo Pet House', 'petshops', 'R. Me. Ana, 393', '+55 51 3239-4861', -30.0781596, -51.1978218, 'Seg a Sex 9h30–18h · Sáb 9h30–16h30 · Dom fechado', 4.9, 54),
  ('Banrisul – Agência Glória', 'bancos', 'Av. Prof. Oscar Pereira, 2542', '+55 51 3208-6750', -30.0728156, -51.2029539, 'Seg a Sex, 10h–16h', 2.4, 45),
  ('Lotérica Oscar da Sorte', 'loterias', 'Av. Prof. Oscar Pereira, 2456', '+55 51 3245-3258', -30.0720972, -51.2033837, 'Seg a Sex 9h–18h · Sáb 9h–12h30 · Dom fechado', 4.8, 56),
  ('UAI Casa Lotérica', 'loterias', 'Av. Prof. Oscar Pereira, 2456', null, -30.0721717, -51.2034514, 'Seg a Sex 8h30–18h · Sáb 8h30–12h · Dom fechado', 4.1, 425),
  ('RGS Centro Automotivo', 'oficinas', 'R. Dona Veva, 85', '+55 51 99943-4090', -30.0746899, -51.1887499, 'Seg a Sex, 8h–18h · Fim de semana fechado', 4.7, 44),
  ('VMOTORS (elétricos e híbridos)', 'oficinas', 'R. Cel. Aparício Borges, 1399', '+55 51 99865-9336', -30.0725464, -51.1941288, 'Seg a Sex 8h–12h e 13h30–18h · Fim de semana fechado', 4.1, 27),
  ('Agility Auto Estética', 'oficinas', 'R. Cel. Aparício Borges, 1276', '+55 51 3907-4850', -30.0724463, -51.1955708, 'Seg a Sex 8h–12h e 13h30–18h · Fim de semana fechado', 4.9, 64),
  ('Unidade de Saúde Glória (UBS)', 'clinicas', 'Av. Prof. Oscar Pereira, 3229', '+55 51 3289-8189', -30.0781884, -51.1997379, 'Seg a Sex, 7h–19h · Fim de semana fechado', 3.9, 141),
  ('J. Santa Maria Odontologia', 'clinicas', 'R. Campos Elíseos, 46', '+55 51 3228-8487', -30.0718805, -51.2050149, 'Seg a Sex, 8h30–17h30 · Fim de semana fechado', 5.0, 104),
  ('School Our Lady of Glory', 'escolas', 'Av. Prof. Oscar Pereira, 3052', '+55 51 3336-3402', -30.0765569, -51.2001894, 'Consulte diretamente a instituição', null, null),
  ('Colégio Marista Assunção', 'escolas', 'R. Dom Bosco, 103', '+55 51 3086-2100', -30.0754208, -51.2029509, 'Seg a Sex, 7h–18h', null, null),
  ('Crescer & Brilhar Escola Infantil', 'escolas', 'R. Intendente Alfredo Azevedo, 464', '+55 51 98428-4272', -30.0748451, -51.196333, 'Seg a Sex, 7h–19h', 4.8, 28),
  ('Esc. Mun. de Ensino Fundamental Espírito Santo', 'escolas', 'R. Ascenção, 245', '+55 51 3289-5260', -30.0779531, -51.1917876, 'Seg a Sex, 8h–17h', null, null),
  ('Fuszarca Papelaria e Bazar', 'lojas', 'R. Intendente Alfredo Azevedo, 14 - Lj 10', '+55 51 3060-5222', -30.0758166, -51.2008043, 'Seg a Sex 9h–18h30 · Sáb 10h–15h30 · Dom fechado', 4.8, 22)
on conflict do nothing;

-- -------------------------------------------------------------
-- 7) LIMITE DE USO DA GLÓRIA IA (contador compartilhado entre instâncias)
-- -------------------------------------------------------------
-- Usado só pela Netlify Function, via a função consumir_limite_ia abaixo.
-- Sem políticas de RLS: ninguém lê nem escreve direto na tabela.
create table if not exists public.rate_limits (
  ip_hash text primary key,
  janela timestamptz not null,
  contador int not null default 0
);
create index if not exists idx_rate_limits_janela on public.rate_limits (janela);
alter table public.rate_limits enable row level security;

-- Incrementa o contador do IP na janela atual e diz se ainda está dentro do limite.
-- security definer: roda com privilégio do dono, sem expor a tabela ao anon.
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

  -- Limpeza simples de janelas antigas (evita a tabela crescer sem fim).
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
