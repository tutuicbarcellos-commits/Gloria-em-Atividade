'use strict';

/**
 * Glória IA — assistente do Glória em Movimento.
 *
 * Importante: este arquivo NUNCA busca estabelecimentos numa API de IA.
 * Ele manda a mensagem da pessoa pra função /api/gloria-ia,
 * que devolve só a INTENÇÃO (categoria, se quer aberto agora, etc.) — quem
 * filtra e mostra os estabelecimentos de verdade é este arquivo, usando os
 * mesmos dados já carregados do Supabase (variável global `ESTABELECIMENTOS`,
 * populada por `carregarEstabelecimentos()` em js/app.js). Isso garante que a
 * IA nunca invente um estabelecimento, endereço, nota ou horário.
 *
 * Reaproveita várias funções/variáveis já existentes em js/app.js:
 * ESTABELECIMENTOS, CATEGORIAS, CATEGORIA_POR_ID, ICONES, estado,
 * favoritos, distanciaMetros, formatarDistancia, statusAberto,
 * statusAbertoHTML, estrelasHTML, escaparHTML, normalizar,
 * alternarFavorito, abrirDialogDetalhes, inicializarMapa, alternarLocalizacao,
 * CENTRO_BAIRRO, mapaInstancia.
 */

const SUGESTOES_INICIAIS = [
  '💊 Farmácias perto de mim',
  '🍔 Onde comer?',
  '🛒 Mercados próximos',
  '☕ Cafés na Glória',
  '⭐ Lugares bem avaliados',
  '📍 O que tem perto de mim?',
];

const MAX_RESULTADOS_POR_CATEGORIA = 3;
const MAX_HISTORICO_ENVIADO = 6;

const estadoIA = {
  historico: [],       // [{ papel: 'usuario' | 'ia', texto }]
  carregando: false,
  ultimaMensagem: null, // guardada para re-tentar depois de ativar localização
};

function elGIA(id) { return document.getElementById(id); }

/* ---------------------------------------------------------
   Abrir / fechar o painel
   --------------------------------------------------------- */
function abrirPainelIA() {
  const painel = elGIA('painelGloriaIA');
  const fab = elGIA('btnAbrirGloriaIA');
  if (!painel) return;
  painel.hidden = false;
  fab?.setAttribute('aria-expanded', 'true');
  fab?.classList.add('is-oculto');
  if (estadoIA.historico.length === 0) renderizarSugestoes();
  setTimeout(() => elGIA('inputGloriaIA')?.focus(), 50);
}

function fecharPainelIA() {
  const painel = elGIA('painelGloriaIA');
  const fab = elGIA('btnAbrirGloriaIA');
  if (!painel) return;
  painel.hidden = true;
  fab?.setAttribute('aria-expanded', 'false');
  fab?.classList.remove('is-oculto');
}

/* ---------------------------------------------------------
   Sugestões iniciais
   --------------------------------------------------------- */
function renderizarSugestoes() {
  const wrap = elGIA('gloriaIASugestoes');
  if (!wrap) return;
  wrap.innerHTML = SUGESTOES_INICIAIS.map((s) =>
    `<button type="button" data-sugestao="${escaparHTML(s)}">${escaparHTML(s)}</button>`
  ).join('');
}

function esconderSugestoes() {
  const wrap = elGIA('gloriaIASugestoes');
  if (wrap) wrap.innerHTML = '';
}

/* ---------------------------------------------------------
   Bolhas de mensagem
   --------------------------------------------------------- */
function rolarMensagensParaFim() {
  const wrap = elGIA('gloriaIAMensagens');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

function adicionarBolha(texto, classe) {
  const wrap = elGIA('gloriaIAMensagens');
  if (!wrap) return null;
  const bolha = document.createElement('div');
  bolha.className = `gia-msg ${classe}`;
  bolha.textContent = texto;
  wrap.appendChild(bolha);
  rolarMensagensParaFim();
  return bolha;
}

function mostrarCarregando() {
  const wrap = elGIA('gloriaIAMensagens');
  if (!wrap) return null;
  const bolha = document.createElement('div');
  bolha.className = 'gia-msg-carregando';
  bolha.id = 'giaCarregando';
  bolha.innerHTML = '<span class="gia-ponto-pulso"></span> Glória IA está procurando...';
  wrap.appendChild(bolha);
  rolarMensagensParaFim();
  return bolha;
}

function removerCarregando() {
  elGIA('giaCarregando')?.remove();
}

/* ---------------------------------------------------------
   Cards de resultado (reaproveitando helpers de js/app.js)
   --------------------------------------------------------- */
function miniFotoHTML(item) {
  const cat = CATEGORIA_POR_ID[item.categoria];
  if (item.fotoUrl) {
    return `<img src="${item.fotoUrl}" alt="" loading="lazy" data-fallback-categoria="${escaparAtributo(item.categoria)}">`;
  }
  const icone = ICONES[item.categoria] || ICONES.lojas;
  return `<svg viewBox="0 0 24 24" width="24" height="24" style="color:${cat?.cor || 'var(--color-primary)'}">${icone}</svg>`;
}

function criarCardIA(item) {
  const cat = CATEGORIA_POR_ID[item.categoria];
  const nome = escaparHTML(item.nome);
  const ehFavorito = favoritos.has(item.id);
  const linkChegar = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
  const temAvaliacao = typeof item.avaliacao === 'number';

  const li = document.createElement('div');
  li.className = 'gia-card';
  li.innerHTML = `
    <div class="gia-card-foto">${miniFotoHTML(item)}</div>
    <div class="gia-card-corpo">
      <h4>${nome}</h4>
      <div class="gia-card-linha">
        ${statusAbertoHTML(item.horario)}
        <span>${formatarDistancia(item._distancia)}</span>
        <span>${temAvaliacao ? `${estrelasHTML(item.avaliacao)} ${item.avaliacao.toFixed(1)}` : 'Sem avaliações'}</span>
      </div>
      <div class="gia-card-acoes">
        <button type="button" data-gia-mapa="${item.id}">📍 Ver no mapa</button>
        <a href="${linkChegar}" target="_blank" rel="noopener">🧭 Como chegar</a>
        <button type="button" class="${ehFavorito ? 'is-favorito' : ''}" data-gia-favorito="${item.id}">${ehFavorito ? '❤️ Favoritado' : '🤍 Favoritar'}</button>
        <button type="button" data-gia-detalhes="${item.id}">👁️ Ver estabelecimento</button>
      </div>
    </div>`;
  return li;
}

function criarBotaoAmpliarFiltro(categoriaId, termoBusca) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gia-btn-ampliar';
  btn.textContent = 'Mostrar mesmo os fechados';
  btn.style.cssText = 'align-self:flex-start;font-size:0.78rem;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid var(--color-line);background:var(--color-surface);color:var(--color-primary);cursor:pointer;';
  btn.addEventListener('click', () => {
    btn.remove();
    const grupo = buscarLocal({ categorias: categoriaId ? [categoriaId] : [], termoBusca, apenasAbertos: false, ordenarPor: null });
    renderizarGrupos(grupo, { tituloQuandoUnico: false });
  }, { once: true });
  return btn;
}

/* ---------------------------------------------------------
   Busca local nos dados reais (nunca inventa nada)
   --------------------------------------------------------- */
function buscarLocal({ categorias, termoBusca, apenasAbertos, ordenarPor }) {
  const origem = estado.localizacaoUsuario || CENTRO_BAIRRO;
  const termo = termoBusca ? normalizar(termoBusca) : '';
  const listaCategorias = categorias && categorias.length ? categorias : [null];

  return listaCategorias.map((categoriaId) => {
    let lista = ESTABELECIMENTOS.filter((item) => {
      const bateCategoria = !categoriaId || item.categoria === categoriaId;
      const bateTermo = !termo || normalizar(item.nome).includes(termo) || normalizar(item.endereco).includes(termo);
      const bateAberto = !apenasAbertos || (() => { const s = statusAberto(item.horario); return s.conhecido && s.aberto; })();
      return bateCategoria && bateTermo && bateAberto;
    }).map((item) => ({ ...item, _distancia: distanciaMetros(origem.lat, origem.lng, item.lat, item.lng) }));

    if (ordenarPor === 'avaliacao') {
      lista.sort((a, b) => (b.avaliacao ?? -1) - (a.avaliacao ?? -1));
    } else {
      lista.sort((a, b) => a._distancia - b._distancia);
    }

    return { categoriaId, itens: lista.slice(0, MAX_RESULTADOS_POR_CATEGORIA), apenasAbertosAtivo: apenasAbertos };
  });
}

function renderizarGrupos(grupos, { termoBusca } = {}) {
  const wrap = elGIA('gloriaIAMensagens');
  if (!wrap) return;
  const mostrarTitulo = grupos.length > 1;

  grupos.forEach(({ categoriaId, itens, apenasAbertosAtivo }) => {
    const grupoEl = document.createElement('div');
    grupoEl.className = 'gia-grupo';

    if (mostrarTitulo) {
      const titulo = document.createElement('div');
      titulo.className = 'gia-grupo-titulo';
      titulo.textContent = categoriaId ? (CATEGORIA_POR_ID[categoriaId]?.label || categoriaId) : 'Resultados';
      grupoEl.appendChild(titulo);
    }

    if (itens.length === 0) {
      const vazio = document.createElement('div');
      vazio.className = 'gia-msg gia-msg-ia';
      vazio.textContent = 'Não encontrei estabelecimentos que correspondam a essa busca.';
      grupoEl.appendChild(vazio);
      if (apenasAbertosAtivo) grupoEl.appendChild(criarBotaoAmpliarFiltro(categoriaId, termoBusca));
    } else {
      itens.forEach((item) => grupoEl.appendChild(criarCardIA(item)));
    }

    wrap.appendChild(grupoEl);
  });
  rolarMensagensParaFim();
}

/* ---------------------------------------------------------
   Bloco de "preciso da sua localização"
   --------------------------------------------------------- */
function mostrarPedidoLocalizacao() {
  const wrap = elGIA('gloriaIAMensagens');
  if (!wrap) return;
  const bloco = document.createElement('div');
  bloco.className = 'gia-grupo';
  bloco.innerHTML = `<button type="button" class="btn-primario" id="giaBtnAtivarLocalizacao" style="margin-top:0">📍 Ativar minha localização</button>`;
  wrap.appendChild(bloco);
  rolarMensagensParaFim();

  bloco.querySelector('#giaBtnAtivarLocalizacao').addEventListener('click', async () => {
    await alternarLocalizacao();
    aguardarLocalizacaoEReenviar();
  }, { once: true });
}

function aguardarLocalizacaoEReenviar() {
  let tentativas = 0;
  const intervalo = setInterval(() => {
    tentativas += 1;
    if (estado.localizacaoUsuario) {
      clearInterval(intervalo);
      if (estadoIA.ultimaMensagem) processarMensagem(estadoIA.ultimaMensagem, { repetida: true });
    } else if (tentativas > 20) {
      clearInterval(intervalo);
    }
  }, 500);
}

/* ---------------------------------------------------------
   Envio da mensagem
   --------------------------------------------------------- */
async function processarMensagem(texto, { repetida = false } = {}) {
  if (!texto.trim() || estadoIA.carregando) return;
  estadoIA.carregando = true;
  estadoIA.ultimaMensagem = texto;

  if (!repetida) {
    adicionarBolha(texto, 'gia-msg-usuario');
    estadoIA.historico.push({ papel: 'usuario', texto });
  }
  esconderSugestoes();
  mostrarCarregando();

  let json;
  try {
    const resp = await fetch('/api/gloria-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensagem: texto,
        historico: estadoIA.historico.slice(-MAX_HISTORICO_ENVIADO),
        categorias: CATEGORIAS.map((c) => ({ id: c.id, label: c.label })),
        temLocalizacao: !!estado.localizacaoUsuario,
      }),
    });

    if (resp.status === 404) {
      console.error('Glória IA: função não encontrada (404). Confira se "api/gloria-ia.js" foi publicado na Vercel.');
      json = { erro: true, resposta: 'A assistente ainda não está publicada neste site. Tente novamente mais tarde.' };
    } else {
      json = await resp.json();
      if (!resp.ok) console.error('Glória IA: resposta HTTP', resp.status, json);
    }
  } catch (err) {
    console.error('Glória IA: falha de rede ao chamar a função —', err);
    json = { erro: true, resposta: 'Não consegui me conectar à assistente. Verifique sua internet e tente de novo.' };
  }

  removerCarregando();
  estadoIA.carregando = false;

  if (json.erro) {
    adicionarBolha(json.resposta, 'gia-msg-erro');
    return;
  }

  adicionarBolha(json.resposta, 'gia-msg-ia');
  estadoIA.historico.push({ papel: 'ia', texto: json.resposta });

  if (json.foraDeEscopo) return;

  if (json.precisaLocalizacao && !estado.localizacaoUsuario) {
    mostrarPedidoLocalizacao();
    return;
  }

  if (estabelecimentosComErro) {
    adicionarBolha('Não consegui carregar os estabelecimentos agora. Verifique sua conexão e tente de novo.', 'gia-msg-erro');
    return;
  }
  if (!estabelecimentosCarregados) {
    adicionarBolha('Ainda estou carregando os estabelecimentos do bairro — tenta de novo em um instante.', 'gia-msg-erro');
    return;
  }

  const grupos = buscarLocal({
    categorias: json.categorias,
    termoBusca: json.termoBusca,
    apenasAbertos: json.apenasAbertos,
    ordenarPor: json.ordenarPor,
  });
  renderizarGrupos(grupos, { termoBusca: json.termoBusca });
}

/* ---------------------------------------------------------
   Ações dos cards (delegação de evento)
   --------------------------------------------------------- */
async function tratarCliqueMensagens(e) {
  const btnMapa = e.target.closest('[data-gia-mapa]');
  const btnFavorito = e.target.closest('[data-gia-favorito]');
  const btnDetalhes = e.target.closest('[data-gia-detalhes]');

  if (btnMapa) {
    const item = ESTABELECIMENTOS.find((i) => i.id === btnMapa.dataset.giaMapa);
    if (!item) return;
    await inicializarMapa();
    if (!mapaInstancia) { mostrarAviso('Não foi possível carregar o mapa agora.'); return; }
    mapaInstancia.setView([item.lat, item.lng], 17);
    L.popup().setLatLng([item.lat, item.lng]).setContent(`<strong>${escaparHTML(item.nome)}</strong>`).openOn(mapaInstancia);
    if (window.innerWidth < 900) fecharPainelIA();
    document.getElementById('mapa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (btnFavorito) {
    const id = btnFavorito.dataset.giaFavorito;
    const resultado = await alternarFavorito(id);
    if (resultado.ok) {
      btnFavorito.classList.toggle('is-favorito', resultado.favoritado);
      btnFavorito.textContent = resultado.favoritado ? '❤️ Favoritado' : '🤍 Favoritar';
    }
    return;
  }

  if (btnDetalhes) {
    abrirDialogDetalhes(btnDetalhes.dataset.giaDetalhes);
  }
}

/* ---------------------------------------------------------
   Inicialização
   --------------------------------------------------------- */
function initGloriaIA() {
  elGIA('btnAbrirGloriaIA')?.addEventListener('click', abrirPainelIA);
  elGIA('btnFecharGloriaIA')?.addEventListener('click', fecharPainelIA);

  elGIA('formGloriaIA')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = elGIA('inputGloriaIA');
    const texto = input.value;
    input.value = '';
    processarMensagem(texto);
  });

  elGIA('gloriaIASugestoes')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sugestao]');
    if (btn) processarMensagem(btn.dataset.sugestao);
  });

  elGIA('gloriaIAMensagens')?.addEventListener('click', tratarCliqueMensagens);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elGIA('painelGloriaIA')?.hidden && !document.querySelector('dialog[open]')) fecharPainelIA();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGloriaIA);
} else {
  initGloriaIA();
}
