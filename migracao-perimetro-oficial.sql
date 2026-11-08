-- =============================================================
-- GLÓRIA EM MOVIMENTO — Migração: remover estabelecimentos fora
-- do perímetro oficial do bairro Glória (Lei nº 12.112/2016)
-- =============================================================
-- Contexto: comparei as coordenadas dos estabelecimentos com o
-- perímetro oficial da Lei nº 12.112/2016 (que delimita o bairro
-- Glória por um trecho específico da Av. Prof. Oscar Pereira — só
-- entre a Rua Nunes e a Rua Dom João VI — e da Av. Cel. Aparício
-- Borges — só entre a Rua Pedro Boticário e a Rua São Miguel — e
-- não pelas avenidas inteiras), e conferi caso a caso as ruas
-- restantes contra o bairro que o próprio Google atribui a cada
-- endereço (fonte independente da minha estimativa geométrica).
--
-- Resultado:
-- - Farma Popular, Agility Treinamento Físico, Agropet Glória:
--   na encosta do Morro da Polícia — já Cascata/Teresópolis.
-- - Vírus da Sorte Loterias: além da Rua São Miguel — já no bairro
--   Coronel Aparício Borges (separado oficialmente da Glória
--   desde 2016).
-- - DG Kar: Rua João Bonuma é oficialmente bairro Partenon, não
--   Glória (confirmado pelo próprio endereço do Google).
--
-- Conferidos e CONFIRMADOS como dentro do bairro (não removidos):
-- RGS Centro Automotivo (R. Dona Veva) e Esc. Mun. Espírito Santo
-- (R. Ascenção) — o Google marca as duas ruas como "Glória".
--
-- Usamos "ativo = false" em vez de apagar a linha, para não
-- arrastar junto favoritos/avaliações que algum usuário real já
-- tenha feito nesses estabelecimentos (soft delete).
-- =============================================================

update public.estabelecimentos
set ativo = false, atualizado_em = now()
where nome in (
  'Farma Popular',
  'Agility Treinamento Físico (Box Cross)',
  'Agropet Glória',
  'Vírus da Sorte Loterias',
  'DG Kar'
);
