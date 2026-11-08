'use strict';

/**
 * Os estabelecimentos, categorias, favoritos e avaliações abaixo vêm do
 * Supabase (banco de dados real — ver js/supabase-config.js e
 * supabase/schema.sql). Nada aqui é lista fixa: `carregarEstabelecimentos()`
 * busca no banco a cada carregamento da página.
 */

const ICONES = {
  farmacias: '<path d="M10 3h4v5h5v4h-5v9h-4v-9H5V8h5z" fill="currentColor"/>',
  mercados: '<path d="M4 4h2l1.2 10.4A2 2 0 0 0 9.2 16h8.1a2 2 0 0 0 2-1.6L20.5 8H6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="20" r="1.4" fill="currentColor"/><circle cx="17" cy="20" r="1.4" fill="currentColor"/>',
  restaurantes: '<path d="M6 2v8a2 2 0 0 0 4 0V2M8 2v20M18 2c-2.2 0-4 2.7-4 6s1.8 6 4 6v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  padarias: '<path d="M6 11c0-4 2.7-7 6-7s6 3 6 7v2H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 13h16l-1.4 7.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  academias: '<path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  petshops: '<circle cx="7" cy="8" r="1.6" fill="currentColor"/><circle cx="12" cy="6" r="1.6" fill="currentColor"/><circle cx="17" cy="8" r="1.6" fill="currentColor"/><circle cx="19.5" cy="12.5" r="1.6" fill="currentColor"/><path d="M12 12c-3 0-6 2.2-6 5.2 0 2 1.6 2.8 3 2.2 1-.4 2-.4 3-.4s2 0 3 .4c1.4.6 3-.2 3-2.2C18 14.2 15 12 12 12z" fill="currentColor"/>',
  bancos: '<path d="M3 10 12 4l9 6M4 10v9M8 10v9M12 10v9M16 10v9M20 10v9M3 21h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  loterias: '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 6v12M15 6v12" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/>',
  oficinas: '<path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L3 17.5 5.5 20l6.3-6.3a4 4 0 0 0 4.9-5.4l-2.6 2.6-2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  clinicas: '<path d="M12 21s-7-4.6-9.3-8.7C1.3 9 3.4 5.8 6.6 5.8c1.9 0 3.3 1 4.4 2.5.3.4.9.4 1.2 0 1.1-1.5 2.5-2.5 4.4-2.5 3.2 0 5.3 3.2 3.9 6.5C19 16.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 12h2.5l1.3-2.6L11.5 15l1.3-3H18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  escolas: '<path d="M2 8l10-4 10 4-10 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5M20 8v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  lojas: '<path d="M4 8h16l-1 12.2a2 2 0 0 1-2 1.8H7a2 2 0 0 1-2-1.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};

const CATEGORIAS = [
  { id: 'farmacias', label: 'Farmácias', cor: '#16A34A', corBg: '#E9F9EE' },
  { id: 'mercados', label: 'Mercados', cor: '#0EA5E9', corBg: '#E4F5FD' },
  { id: 'restaurantes', label: 'Restaurantes', cor: '#F97316', corBg: '#FFF1E6' },
  { id: 'padarias', label: 'Padarias', cor: '#B45309', corBg: '#FDF1DE' },
  { id: 'academias', label: 'Academias', cor: '#8B5CF6', corBg: '#F1ECFE' },
  { id: 'petshops', label: 'Pet Shops', cor: '#EAB308', corBg: '#FEF9E7' },
  { id: 'bancos', label: 'Bancos', cor: '#0EA5A4', corBg: '#E6F8F7' },
  { id: 'loterias', label: 'Loterias', cor: '#7C3AED', corBg: '#F1ECFE' },
  { id: 'oficinas', label: 'Oficinas', cor: '#2563EB', corBg: '#E9EFFE' },
  { id: 'clinicas', label: 'Clínicas', cor: '#16A34A', corBg: '#E9F9EE' },
  { id: 'escolas', label: 'Escolas', cor: '#6366F1', corBg: '#ECEBFE' },
  { id: 'lojas', label: 'Lojas', cor: '#F97316', corBg: '#FFF1E6' },
];
const CATEGORIA_POR_ID = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

let ESTABELECIMENTOS = [];       // populado por carregarEstabelecimentos()
let estabelecimentosCarregados = false;
let estabelecimentosComErro = false;

function mapEstabelecimentoDB(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    categoria: linha.categoria_id,
    endereco: linha.endereco,
    telefone: linha.telefone,
    website: urlSegura(linha.website),
    descricao: linha.descricao || null,
    horario: linha.horario,
    lat: linha.latitude,
    lng: linha.longitude,
    fotoUrl: urlSegura(linha.foto_url),
    avaliacao: linha.nota_media != null ? Number(linha.nota_media) : null,
    avaliacoes: linha.total_avaliacoes_app > 0 ? linha.total_avaliacoes_app : (linha.avaliacoes_google ?? null),
  };
}

async function carregarEstabelecimentos() {
  try {
    const { data, error } = await supabaseClient
      .from('estabelecimentos_com_media')
      .select('*')
      .eq('ativo', true);
    if (error) throw error;
    ESTABELECIMENTOS = (data || []).map(mapEstabelecimentoDB);
    estabelecimentosComErro = false;
    const contadorHero = document.getElementById('statComercios');
    if (contadorHero) contadorHero.textContent = ESTABELECIMENTOS.length;
  } catch (err) {
    console.error('Erro ao carregar estabelecimentos do Supabase:', err);
    ESTABELECIMENTOS = [];
    estabelecimentosComErro = true;
  } finally {
    estabelecimentosCarregados = true;
    renderizarResultados();
  }
}

const CENTRO_BAIRRO = { lat: -30.0615, lng: -51.0923 };

/* ---------------------------------------------------------
   Estado
   --------------------------------------------------------- */
const estado = {
  termo: '',
  categoria: null,       // null = todas
  modoFavoritos: false,
  ordenar: 'proximidade',
  localizacaoUsuario: null,
  apenasAbertoAgora: false,
};

const TEMA_KEY = 'gloria:tema';

// Favoritos agora vivem no banco (tabela `favoritos`), ligados à conta.
// Mantemos um Set local só como cache de UI, recarregado a cada login/logout.
let favoritos = new Set();

async function recarregarFavoritos() {
  if (!usuarioAtual) { favoritos = new Set(); return; }
  const { data, error } = await supabaseClient
    .from('favoritos')
    .select('estabelecimento_id')
    .eq('usuario_id', usuarioAtual.id);
  if (error) { console.error('Erro ao carregar favoritos:', error); return; }
  favoritos = new Set((data || []).map(r => r.estabelecimento_id));
}

async function alternarFavorito(estabelecimentoId) {
  if (!usuarioAtual) {
    mostrarAviso('Faça login para favoritar e sincronizar entre dispositivos.');
    abrirDialogAuth('entrar');
    return { ok: false };
  }
  const jaEra = favoritos.has(estabelecimentoId);
  // Atualização otimista: muda a UI antes da resposta do servidor confirmar.
  if (jaEra) favoritos.delete(estabelecimentoId); else favoritos.add(estabelecimentoId);

  const acao = jaEra
    ? supabaseClient.from('favoritos').delete().eq('usuario_id', usuarioAtual.id).eq('estabelecimento_id', estabelecimentoId)
    : supabaseClient.from('favoritos').insert({ usuario_id: usuarioAtual.id, estabelecimento_id: estabelecimentoId });

  const { error } = await acao;
  if (error) {
    // Reverte se o servidor recusou (ex.: sessão expirou)
    if (jaEra) favoritos.add(estabelecimentoId); else favoritos.delete(estabelecimentoId);
    console.error('Erro ao salvar favorito:', error);
    mostrarAviso('Não foi possível salvar o favorito agora. Tente de novo.');
    return { ok: false };
  }
  return { ok: true, favoritado: !jaEra };
}

/* ---------------------------------------------------------
   Utilidades
   --------------------------------------------------------- */
function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
function normalizar(texto) {
  return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
// Só aceita links http(s); bloqueia javascript:, data: etc.
function urlSegura(valor) {
  if (!valor) return null;
  try {
    const u = new URL(String(valor).trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
  } catch { return null; }
}

function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// Para usar dentro de atributos HTML (aspas incluídas).
function escaparAtributo(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Foto que não carrega: a ilustração da categoria entra no lugar da imagem.
// Substitui os antigos onerror="..." inline, que a CSP bloqueia. A captura
// (3º argumento) é necessária porque o evento "error" de imagem não sobe na árvore.
document.addEventListener('error', (evento) => {
  const img = evento.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.fallbackCategoria) return;
  const categoriaId = img.dataset.fallbackCategoria;
  const cat = CATEGORIA_POR_ID[categoriaId];
  const icone = ICONES[categoriaId] || ICONES.lojas;
  const ilustracao = document.createElement('span');
  ilustracao.className = 'resultado-foto-ilustracao';
  ilustracao.style.setProperty('--cor', cat?.cor || 'var(--color-primary)');
  ilustracao.style.setProperty('--cor-bg', cat?.corBg || 'var(--color-primary-bg)');
  ilustracao.setAttribute('aria-hidden', 'true');
  ilustracao.innerHTML = `<svg viewBox="0 0 24 24" width="36" height="36">${icone}</svg>`;
  img.replaceWith(ilustracao);
}, true);
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function formatarDistancia(m) {
  return m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/* ---------------------------------------------------------
   Horário de funcionamento → "Aberto agora" / "Fechado"
   Interpreta os textos livres de horário (ex.: "Seg a Sex 8h–18h ·
   Sáb 8h–12h · Dom fechado") de forma conservadora: só afirma um
   status quando tem certeza. Se o texto usar algo ambíguo (ex.:
   "tardinha") ou não mencionar um dia, prefere não dizer nada a
   arriscar informar "aberto"/"fechado" errado.
   --------------------------------------------------------- */
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const APELIDOS_DIA_SEMANA = { seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sáb: 'sab', sab: 'sab', dom: 'dom' };

function horaParaMinutos(txt) {
  const m = txt.match(/(\d{1,2})h(\d{2})?/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2] || 0);
}
function expandirIntervaloDiasSemana(token) {
  token = token.trim();
  if (/todos os dias/i.test(token)) return [...DIAS_SEMANA];
  const m = token.match(/^(Seg|Ter|Qua|Qui|Sex|Sáb|Sab|Dom)\s*a\s*(Seg|Ter|Qua|Qui|Sex|Sáb|Sab|Dom)$/i);
  if (m) {
    const a = APELIDOS_DIA_SEMANA[m[1].toLowerCase()];
    const b = APELIDOS_DIA_SEMANA[m[2].toLowerCase()];
    const ordem = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    const ia = ordem.indexOf(a), ib = ordem.indexOf(b);
    if (ia === -1 || ib === -1 || ia > ib) return null;
    return ordem.slice(ia, ib + 1);
  }
  const dm = token.match(/^(Seg|Ter|Qua|Qui|Sex|Sáb|Sab|Dom)$/i);
  if (dm) return [APELIDOS_DIA_SEMANA[dm[1].toLowerCase()]];
  if (/fim de semana/i.test(token)) return ['sab', 'dom'];
  return null;
}
function interpretarHorario(texto) {
  if (!texto || /consulte|tardinha/i.test(texto)) return null;
  const resultado = Object.fromEntries(DIAS_SEMANA.map(d => [d, null]));
  for (let bloco of texto.split('·').map(s => s.trim())) {
    bloco = bloco.replace(',', ' ');
    if (/fechado/i.test(bloco)) {
      const dias = expandirIntervaloDiasSemana(bloco.replace(/fechado/i, '').trim());
      if (!dias) return null;
      dias.forEach(d => { resultado[d] = []; });
      continue;
    }
    const partesBloco = bloco.match(/^(.*?)(\d{1,2}h.*)$/);
    if (!partesBloco) return null;
    const dias = expandirIntervaloDiasSemana(partesBloco[1].trim());
    if (!dias) return null;
    const intervalos = partesBloco[2].split(/\s+e\s+/i).map(parte => {
      const [ini, fim] = parte.split(/[–-]/).map(s => s.trim());
      const iniMin = horaParaMinutos(ini || ''), fimMin = horaParaMinutos(fim || '');
      return (iniMin == null || fimMin == null) ? null : [iniMin, fimMin];
    });
    if (intervalos.some(i => i === null)) return null;
    dias.forEach(d => { resultado[d] = (resultado[d] || []).concat(intervalos); });
  }
  return resultado;
}
function agoraEmPortoAlegre() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date());
  const obter = (tipo) => partes.find(p => p.type === tipo)?.value;
  const diaAbrev = { Sun: 'dom', Mon: 'seg', Tue: 'ter', Wed: 'qua', Thu: 'qui', Fri: 'sex', Sat: 'sab' }[obter('weekday')];
  const hora = Number(obter('hour')) % 24;
  const minuto = Number(obter('minute'));
  return { dia: diaAbrev, minutos: hora * 60 + minuto };
}
function formatarHora(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
function statusAberto(horarioTexto) {
  const estrutura = interpretarHorario(horarioTexto);
  if (!estrutura) return { conhecido: false };
  const { dia, minutos } = agoraEmPortoAlegre();
  const intervalosHoje = estrutura[dia];
  if (intervalosHoje === null) return { conhecido: false };
  if (intervalosHoje.length === 0) return { conhecido: true, aberto: false };
  for (const [ini, fim] of intervalosHoje) {
    if (minutos >= ini && minutos < fim) return { conhecido: true, aberto: true, fechaAs: formatarHora(fim) };
  }
  const proxima = intervalosHoje.find(([ini]) => ini > minutos);
  return { conhecido: true, aberto: false, abreAs: proxima ? formatarHora(proxima[0]) : null };
}
function statusAbertoHTML(horarioTexto) {
  const s = statusAberto(horarioTexto);
  if (!s.conhecido) return '';
  if (s.aberto) return `<span class="badge-aberto">Aberto agora${s.fechaAs ? ` · fecha às ${s.fechaAs}` : ''}</span>`;
  return `<span class="badge-fechado">Fechado${s.abreAs ? ` · abre às ${s.abreAs}` : ''}</span>`;
}

function mostrarAviso(mensagem) {
  const toast = document.getElementById('toastAviso');
  if (!toast) return;
  toast.textContent = mensagem;
  toast.hidden = false;
  clearTimeout(mostrarAviso._t);
  mostrarAviso._t = setTimeout(() => { toast.hidden = true; }, 3200);
}

/* ---------------------------------------------------------
   Tema claro/escuro
   --------------------------------------------------------- */
function initTema() {
  const btn = document.getElementById('btnTema');
  let salvo = null;
  try { salvo = localStorage.getItem(TEMA_KEY); } catch { /* localStorage indisponível */ }
  const prefereEscuro = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const preferido = salvo || (prefereEscuro ? 'escuro' : 'claro');
  aplicarTema(preferido);
  btn?.addEventListener('click', () => {
    const atual = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro';
    aplicarTema(atual);
    try { localStorage.setItem(TEMA_KEY, atual); } catch { /* ignorar */ }
  });
}
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  document.getElementById('btnTema')?.setAttribute('aria-pressed', String(tema === 'escuro'));
}

/* ---------------------------------------------------------
   Menu mobile
   --------------------------------------------------------- */
function initMenu() {
  const btn = document.getElementById('btnMenu');
  const nav = document.getElementById('menuMobile');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const aberto = nav.hidden;
    nav.hidden = !aberto;
    btn.setAttribute('aria-expanded', String(aberto));
  });
}

/* ---------------------------------------------------------
   Navegação que depende de conta (Favoritos / Histórico / Perfil / Entrar)
   --------------------------------------------------------- */
function initNavConta() {
  // btnEntrar já é tratado em auth.js (abre o modal de login real).
  const abrirHistorico = (e) => { e.preventDefault(); abrirDialogHistorico(); };
  document.getElementById('linkHistorico')?.addEventListener('click', abrirHistorico);
  document.getElementById('linkHistoricoMobile')?.addEventListener('click', abrirHistorico);
  document.getElementById('tabHistorico')?.addEventListener('click', abrirHistorico);

  const abrirPerfilOuLogin = (e) => {
    e.preventDefault();
    if (usuarioAtual) abrirDialogPerfil(); else abrirDialogAuth('entrar');
  };
  document.getElementById('tabPerfil')?.addEventListener('click', abrirPerfilOuLogin);

  const abrirFavoritos = (e) => { e.preventDefault(); abrirFavoritosDoMenu(); };
  document.getElementById('linkFavoritos')?.addEventListener('click', abrirFavoritos);
  document.getElementById('linkFavoritosMobile')?.addEventListener('click', abrirFavoritos);
  document.getElementById('tabFavoritos')?.addEventListener('click', abrirFavoritos);
}

function abrirFavoritosDoMenu() {
  if (!usuarioAtual) { mostrarAviso('Faça login para ver seus favoritos.'); abrirDialogAuth('entrar'); return; }
  estado.modoFavoritos = true;
  estado.categoria = null;
  atualizarCategoriasAtivas();
  renderizarResultados();
  document.getElementById('mapa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------------------------------------------------------
   Minhas avaliações (a partir do menu do avatar)
   --------------------------------------------------------- */
async function abrirDialogMinhasAvaliacoes() {
  if (!usuarioAtual) { mostrarAviso('Faça login para ver suas avaliações.'); abrirDialogAuth('entrar'); return; }
  const dialog = document.getElementById('dialogHistorico'); // reaproveita o mesmo modal genérico de lista
  const lista = document.getElementById('listaHistorico');
  if (!dialog || !lista) return;
  const titulo = document.getElementById('tituloHistorico');
  const aviso = dialog.querySelector('.dialog-aviso');
  const vazio = document.getElementById('historicoVazio');
  const btnLimpar = document.getElementById('btnLimparHistorico');

  titulo.textContent = 'Minhas avaliações';
  if (aviso) aviso.textContent = 'Suas avaliações publicadas no Glória em Movimento.';
  if (btnLimpar) btnLimpar.hidden = true;
  lista.innerHTML = '<li>Carregando…</li>';

  const { data, error } = await supabaseClient
    .from('avaliacoes')
    .select('id, nota, comentario, criado_em, estabelecimentos ( id, nome )')
    .eq('usuario_id', usuarioAtual.id)
    .order('criado_em', { ascending: false });

  if (error) { lista.innerHTML = ''; mostrarAviso('Não foi possível carregar suas avaliações agora.'); console.error(error); return; }

  const itens = data || [];
  vazio.hidden = itens.length !== 0;
  vazio.textContent = 'Você ainda não avaliou nenhum estabelecimento.';
  lista.innerHTML = itens.map(av => `
    <li>
      <span>${'★'.repeat(av.nota)}${'☆'.repeat(5 - av.nota)} ${escaparHTML(av.estabelecimentos?.nome || '')}${av.comentario ? ' — ' + escaparHTML(av.comentario) : ''}</span>
      <time>${new Date(av.criado_em).toLocaleDateString('pt-BR')}</time>
    </li>`).join('');

  if (typeof dialog.showModal === 'function') dialog.showModal();
}

/* ---------------------------------------------------------
   Categorias
   --------------------------------------------------------- */
function initCategorias() {
  const wrap = document.getElementById('categorias');
  const mapaChips = document.getElementById('mapaChips');
  const mapaLista = document.getElementById('mapaCategoriasLista');

  if (wrap) {
    wrap.innerHTML = CATEGORIAS.map(cat => `
      <button type="button" class="categoria-btn" data-categoria="${cat.id}" style="--cor:${cat.cor}; --cor-bg:${cat.corBg}">
        <span class="categoria-icone"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${ICONES[cat.id]}</svg></span>
        ${cat.label}
      </button>`).join('');
  }
  if (mapaChips) {
    mapaChips.innerHTML = ['<button type="button" class="mapa-chip is-ativa" data-categoria="">Todos</button>']
      .concat(CATEGORIAS.map(cat => `<button type="button" class="mapa-chip" data-categoria="${cat.id}">${cat.label}</button>`))
      .join('');
  }
  if (mapaLista) {
    mapaLista.innerHTML = ['<button type="button" class="mapa-categoria-item is-ativa" data-categoria=""><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>Todos</button>']
      .concat(CATEGORIAS.map(cat => `
        <button type="button" class="mapa-categoria-item" data-categoria="${cat.id}">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${ICONES[cat.id]}</svg>${cat.label}
        </button>`))
      .join('');
  }

  const aoClicarCategoria = (e) => {
    const btn = e.target.closest('[data-categoria]');
    if (!btn) return;
    const id = btn.dataset.categoria || null;
    estado.modoFavoritos = false;
    estado.categoria = estado.categoria === id ? null : id;
    atualizarCategoriasAtivas();
    renderizarResultados();
  };
  wrap?.addEventListener('click', aoClicarCategoria);
  mapaChips?.addEventListener('click', aoClicarCategoria);
  mapaLista?.addEventListener('click', aoClicarCategoria);
}
function limparFiltros() {
  estado.termo = '';
  estado.categoria = null;
  estado.modoFavoritos = false;
  estado.ordenar = 'proximidade';
  estado.apenasAbertoAgora = false;
  ['inputBusca', 'inputBuscaMapa'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const select = document.getElementById('selectOrdenar');
  if (select) select.value = 'proximidade';
  const checkAberto = document.getElementById('checkAbertoAgora');
  if (checkAberto) checkAberto.checked = false;
  atualizarCategoriasAtivas();
  renderizarResultados();
}

function atualizarCategoriasAtivas() {
  document.querySelectorAll('.categoria-btn').forEach(btn => {
    btn.classList.toggle('is-ativa', !estado.modoFavoritos && btn.dataset.categoria === estado.categoria);
  });
  document.querySelectorAll('.mapa-chip, .mapa-categoria-item').forEach(btn => {
    const valor = btn.dataset.categoria || null;
    btn.classList.toggle('is-ativa', !estado.modoFavoritos && valor === estado.categoria);
  });
  const label = document.getElementById('categoriaAtualLabel');
  if (!label) return;
  if (estado.modoFavoritos) label.textContent = 'Seus favoritos';
  else if (estado.categoria) label.textContent = CATEGORIA_POR_ID[estado.categoria]?.label || 'Comércios';
  else label.textContent = 'Todos os comércios';
}

/* ---------------------------------------------------------
   Busca
   --------------------------------------------------------- */
function initBusca() {
  const form = document.getElementById('formBusca');
  const input = document.getElementById('inputBusca');
  const inputMapa = document.getElementById('inputBuscaMapa');

  const aoDigitar = debounce((valor, origem) => {
    estado.termo = valor;
    if (origem !== 'principal' && input) input.value = valor;
    if (origem !== 'mapa' && inputMapa) inputMapa.value = valor;
    renderizarResultados();
    registrarBuscaNoHistorico(valor);
  }, 150);

  form?.addEventListener('submit', e => e.preventDefault());
  input?.addEventListener('input', e => aoDigitar(e.target.value, 'principal'));
  inputMapa?.addEventListener('input', e => aoDigitar(e.target.value, 'mapa'));
}

/* ---------------------------------------------------------
   Histórico (buscas e estabelecimentos vistos)
   --------------------------------------------------------- */
function registrarBuscaNoHistorico(termo) {
  const t = termo.trim();
  if (!usuarioAtual || t.length < 2) return;
  supabaseClient.from('historico').insert({ usuario_id: usuarioAtual.id, termo_busca: t })
    .then(({ error }) => { if (error) console.error('Erro ao salvar busca no histórico:', error); });
}

function registrarVisitaNoHistorico(estabelecimentoId) {
  if (!usuarioAtual) return;
  supabaseClient.from('historico').insert({ usuario_id: usuarioAtual.id, estabelecimento_id: estabelecimentoId })
    .then(({ error }) => { if (error) console.error('Erro ao salvar visita no histórico:', error); });
}

async function abrirDialogHistorico() {
  if (!usuarioAtual) { mostrarAviso('Faça login para ver seu histórico.'); abrirDialogAuth('entrar'); return; }
  const dialog = document.getElementById('dialogHistorico');
  const titulo = document.getElementById('tituloHistorico');
  const aviso = dialog?.querySelector('.dialog-aviso');
  const lista = document.getElementById('listaHistorico');
  const vazio = document.getElementById('historicoVazio');
  const btnLimpar = document.getElementById('btnLimparHistorico');
  if (!dialog || !lista) return;

  titulo.textContent = 'Meu histórico';
  if (aviso) aviso.textContent = 'Buscas e estabelecimentos vistos recentemente, salvos na sua conta.';
  if (btnLimpar) btnLimpar.hidden = false;
  lista.innerHTML = '';
  const { data, error } = await supabaseClient
    .from('historico')
    .select('id, termo_busca, criado_em, estabelecimentos ( nome )')
    .eq('usuario_id', usuarioAtual.id)
    .order('criado_em', { ascending: false })
    .limit(20);

  if (error) { console.error('Erro ao carregar histórico:', error); mostrarAviso('Não foi possível carregar o histórico agora.'); return; }

  const itens = data || [];
  vazio.hidden = itens.length !== 0;
  vazio.textContent = 'Seu histórico está vazio.';
  lista.innerHTML = itens.map(item => {
    const texto = item.termo_busca
      ? `Busca: "${escaparHTML(item.termo_busca)}"`
      : `Visitou: ${escaparHTML(item.estabelecimentos?.nome || 'estabelecimento')}`;
    const data = new Date(item.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `<li><span>${texto}</span><time>${data}</time></li>`;
  }).join('');

  if (typeof dialog.showModal === 'function') dialog.showModal();
}

function initHistorico() {
  document.getElementById('btnLimparHistorico')?.addEventListener('click', async () => {
    if (!usuarioAtual) return;
    const { error } = await supabaseClient.from('historico').delete().eq('usuario_id', usuarioAtual.id);
    if (error) { mostrarAviso('Não foi possível limpar o histórico agora.'); return; }
    document.getElementById('listaHistorico').innerHTML = '';
    document.getElementById('historicoVazio').hidden = false;
  });
}

/* ---------------------------------------------------------
   Ordenação
   --------------------------------------------------------- */
function initOrdenacao() {
  const select = document.getElementById('selectOrdenar');
  select?.addEventListener('change', e => {
    estado.ordenar = e.target.value;
    renderizarResultados();
  });
  document.getElementById('checkAbertoAgora')?.addEventListener('change', e => {
    estado.apenasAbertoAgora = e.target.checked;
    renderizarResultados();
  });
}

/* ---------------------------------------------------------
   Filtro + ordenação + renderização dos resultados
   --------------------------------------------------------- */
function obterResultados() {
  const termo = normalizar(estado.termo.trim());
  let lista = ESTABELECIMENTOS.filter(item => {
    if (estado.modoFavoritos) return favoritos.has(item.id);
    const bateCategoria = !estado.categoria || item.categoria === estado.categoria;
    const bateTermo = !termo || normalizar(item.nome).includes(termo) || normalizar(item.endereco).includes(termo);
    // "Aberto agora" só filtra quem tem status CONHECIDO e aberto — quem tem
    // horário ambíguo/não interpretável simplesmente some da lista quando
    // esse filtro está ligado, em vez de arriscar incluir errado.
    const bateAberto = !estado.apenasAbertoAgora || (() => { const s = statusAberto(item.horario); return s.conhecido && s.aberto; })();
    return bateCategoria && bateTermo && bateAberto;
  });

  const origem = estado.localizacaoUsuario || CENTRO_BAIRRO;
  lista = lista.map(item => ({ ...item, _distancia: distanciaMetros(origem.lat, origem.lng, item.lat, item.lng) }));

  if (estado.ordenar === 'avaliacao') {
    lista.sort((a, b) => b.avaliacao - a.avaliacao);
  } else if (estado.ordenar === 'alfabetica') {
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  } else {
    lista.sort((a, b) => a._distancia - b._distancia);
  }
  return lista;
}

function estrelasHTML(nota) {
  return `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2l-5-4.9 6.9-1z" fill="currentColor"/></svg>`;
}

/* Foto real do estabelecimento (quando cadastrada pelo admin) ou,
   na falta dela, uma ilustração da categoria — identifica o tipo
   de comércio de forma clara e não depende de nenhum serviço
   externo (funciona offline, dentro do PWA). */
function fotoEstabelecimentoHTML(item, cat, nome) {
  const icone = ICONES[item.categoria] || ICONES.lojas;
  const ilustracaoHTML = `<span class="resultado-foto-ilustracao" style="--cor:${cat?.cor || 'var(--color-primary)'};--cor-bg:${cat?.corBg || 'var(--color-primary-bg)'}" aria-hidden="true"><svg viewBox="0 0 24 24" width="36" height="36">${icone}</svg></span>`;
  if (item.fotoUrl) {
    return `<img src="${item.fotoUrl}" alt="${nome}" loading="lazy" decoding="async" width="120" height="120"
      data-fallback-categoria="${escaparAtributo(item.categoria)}">`;
  }
  return ilustracaoHTML;
}

function cardHTML(item) {
  const cat = CATEGORIA_POR_ID[item.categoria];
  const nome = escaparHTML(item.nome);
  const endereco = escaparHTML(item.endereco);
  const ehFavorito = favoritos.has(item.id);
  const linkChegar = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
  const telefoneDigitos = item.telefone ? item.telefone.replace(/\D/g, '') : null;
  const linkWhatsapp = telefoneDigitos ? `https://wa.me/${telefoneDigitos}?text=${encodeURIComponent('Olá! Vi o ' + item.nome + ' no Glória em Movimento.')}` : null;
  const temAvaliacao = typeof item.avaliacao === 'number';

  return `
    <li class="resultado-card" data-id="${item.id}">
      <button type="button" class="btn-favorito ${ehFavorito ? 'is-favorito' : ''}" data-favorito="${item.id}"
        aria-pressed="${ehFavorito}" aria-label="${ehFavorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 21s-7-4.6-10-9.2C-0.2 7.6 2.4 4 6 4c2 0 3.6 1.1 4.5 2.7C11.4 5.1 13 4 15 4c3.6 0 6.2 3.6 4 7.8C19 16.4 12 21 12 21z"/></svg>
      </button>
      <div class="resultado-foto">
        ${fotoEstabelecimentoHTML(item, cat, nome)}
      </div>
      <div class="resultado-corpo">
        <div class="resultado-topo">
          <h3>${nome}</h3>
          ${statusAbertoHTML(item.horario)}
        </div>
        <p class="resultado-endereco">${endereco}</p>
        <div class="resultado-linha">
          ${item.telefone ? `<a href="tel:${telefoneDigitos}">${escaparHTML(item.telefone)}</a>` : '<span>Telefone não informado</span>'}
        </div>
        <p class="resultado-horario">${escaparHTML(item.horario)}</p>
        <div class="resultado-linha">
          <span class="resultado-avaliacao">${temAvaliacao ? `${estrelasHTML(item.avaliacao)} ${item.avaliacao.toFixed(1)} (${item.avaliacoes})` : 'Sem avaliações no Google'}</span>
          <span class="resultado-distancia">${formatarDistancia(item._distancia)}</span>
        </div>
        <div class="resultado-acoes">
          <a class="acao-chegar" href="${linkChegar}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z" fill="currentColor"/></svg> Como chegar
          </a>
          ${linkWhatsapp ? `<a class="acao-whatsapp" href="${linkWhatsapp}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2z" fill="currentColor"/></svg> WhatsApp
          </a>` : ''}
          <button type="button" class="acao-detalhes" data-detalhes="${item.id}">Ver detalhes</button>
          <button type="button" class="acao-avaliar" data-avaliar="${item.id}" data-nome="${nome}">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2l-5-4.9 6.9-1z" fill="currentColor"/></svg> Avaliar
          </button>
        </div>
      </div>
    </li>`;
}

function renderizarResultados() {
  const lista = document.getElementById('listaResultados');
  const contador = document.getElementById('contadorResultados');
  const semResultados = document.getElementById('semResultados');
  if (!lista) return;

  if (!estabelecimentosCarregados) {
    // Ainda buscando no Supabase — mantém os esqueletos que já estão no HTML.
    semResultados.hidden = true;
    return;
  }

  if (estabelecimentosComErro) {
    lista.innerHTML = '';
    lista.hidden = true;
    semResultados.hidden = false;
    semResultados.innerHTML = `
      <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z" fill="currentColor"/></svg>
      <h3>Não conseguimos carregar os estabelecimentos</h3>
      <p>Verifique sua conexão e tente novamente.</p>
      <button type="button" class="btn-primario" id="btnTentarNovamente" style="max-width:220px">Tentar novamente</button>`;
    document.getElementById('btnTentarNovamente')?.addEventListener('click', () => {
      estabelecimentosCarregados = false;
      carregarEstabelecimentos();
    });
    if (contador) contador.textContent = 'Erro ao carregar estabelecimentos';
    return;
  }

  const resultados = obterResultados();
  lista.innerHTML = resultados.map(cardHTML).join('');
  lista.hidden = resultados.length === 0;
  if (semResultados) {
    semResultados.hidden = resultados.length !== 0;
    semResultados.innerHTML = `
      <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path d="M10 3a7 7 0 1 0 4.9 12l5.05 5.05 1.4-1.4L16.3 13.6A7 7 0 0 0 10 3zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" fill="currentColor"/></svg>
      <h3>Nenhum lugar encontrado</h3>
      <p>Tente pesquisar por outro termo ou alterar os filtros.</p>
      <button type="button" class="btn-primario" id="btnLimparFiltros" style="max-width:220px">Limpar filtros</button>`;
    document.getElementById('btnLimparFiltros')?.addEventListener('click', limparFiltros);
  }

  const texto = `${resultados.length} resultado${resultados.length === 1 ? '' : 's'} encontrado${resultados.length === 1 ? '' : 's'}`;
  if (contador) contador.textContent = texto;

  atualizarMarcadoresMapa(resultados);
  renderizarProximosNoMapa(resultados);
}

/* Delegação de eventos para favoritos e "ver detalhes" (a lista é recriada a cada render) */
/* ---------------------------------------------------------
   Avaliações (estrelas + comentário, salvas no Supabase)
   --------------------------------------------------------- */
let notaSelecionada = 0;

async function abrirDialogAvaliacao(estabelecimentoId) {
  if (!usuarioAtual) {
    mostrarAviso('Faça login para avaliar um estabelecimento.');
    abrirDialogAuth('entrar');
    return;
  }
  const item = ESTABELECIMENTOS.find(i => i.id === estabelecimentoId);
  if (!item) return;

  document.getElementById('avaliacaoNomeEstabelecimento').textContent = item.nome;
  document.getElementById('avaliacaoEstabelecimentoId').value = estabelecimentoId;
  document.getElementById('avaliacaoComentario').value = '';
  document.getElementById('erroAvaliacao').textContent = '';
  document.getElementById('sucessoAvaliacao').textContent = '';
  selecionarEstrelas(0);

  // Se o usuário já avaliou esse lugar antes, pré-carrega a avaliação dele
  const { data } = await supabaseClient
    .from('avaliacoes')
    .select('nota, comentario')
    .eq('estabelecimento_id', estabelecimentoId)
    .eq('usuario_id', usuarioAtual.id)
    .maybeSingle();
  if (data) {
    selecionarEstrelas(data.nota);
    document.getElementById('avaliacaoComentario').value = data.comentario || '';
  }

  const dialog = document.getElementById('dialogAvaliacao');
  if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
}

function selecionarEstrelas(nota) {
  notaSelecionada = nota;
  document.querySelectorAll('.estrela-btn').forEach(btn => {
    const ativa = Number(btn.dataset.nota) <= nota;
    btn.classList.toggle('is-selecionada', ativa);
    btn.setAttribute('aria-checked', String(Number(btn.dataset.nota) === nota));
  });
}

function initAvaliacao() {
  document.getElementById('estrelasInput')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.estrela-btn');
    if (btn) selecionarEstrelas(Number(btn.dataset.nota));
  });

  document.getElementById('formAvaliacao')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroEl = document.getElementById('erroAvaliacao');
    const sucessoEl = document.getElementById('sucessoAvaliacao');
    erroEl.textContent = ''; sucessoEl.textContent = '';

    if (notaSelecionada < 1) { erroEl.textContent = 'Escolha de 1 a 5 estrelas.'; return; }
    if (!usuarioAtual) { erroEl.textContent = 'Sua sessão expirou — faça login de novo.'; return; }

    const estabelecimentoId = document.getElementById('avaliacaoEstabelecimentoId').value;
    const comentario = document.getElementById('avaliacaoComentario').value.trim() || null;

    const { error } = await supabaseClient.from('avaliacoes').upsert(
      { estabelecimento_id: estabelecimentoId, usuario_id: usuarioAtual.id, nota: notaSelecionada, comentario },
      { onConflict: 'estabelecimento_id,usuario_id' }
    );

    if (error) { erroEl.textContent = 'Não foi possível salvar sua avaliação. Tente novamente.'; console.error(error); return; }
    sucessoEl.textContent = 'Avaliação publicada!';
    await carregarEstabelecimentos(); // atualiza a média exibida nos cards
    setTimeout(() => document.getElementById('dialogAvaliacao')?.close(), 900);
  });
}

/* ---------------------------------------------------------
   Painel administrativo (só visível para perfilAtual.role === 'admin')
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   Página de detalhes do estabelecimento (modal completo)
   --------------------------------------------------------- */
function abrirDialogDetalhes(id) {
  const item = ESTABELECIMENTOS.find(i => i.id === id);
  if (!item) return;
  const dialog = document.getElementById('dialogDetalhes');
  const cat = CATEGORIA_POR_ID[item.categoria];

  document.getElementById('detalhesFoto').innerHTML = item.fotoUrl
    ? `<img src="${item.fotoUrl}" alt="${escaparHTML(item.nome)}" loading="lazy">`
    : `<span class="categoria-icone-fundo" style="background:${cat?.corBg || 'var(--color-primary-bg)'};color:${cat?.cor || 'var(--color-primary)'}"><svg viewBox="0 0 24 24" width="40" height="40">${ICONES[item.categoria] || ''}</svg></span>`;

  document.getElementById('detalhesNome').textContent = item.nome;
  document.getElementById('detalhesCategoria').textContent = cat?.label || '';
  document.getElementById('detalhesStatus').innerHTML = statusAbertoHTML(item.horario);

  const avaliacaoEl = document.getElementById('detalhesAvaliacao');
  avaliacaoEl.innerHTML = typeof item.avaliacao === 'number'
    ? `${estrelasHTML(item.avaliacao)} ${item.avaliacao.toFixed(1)} · ${item.avaliacoes ?? 0} avaliações`
    : 'Sem avaliações ainda';

  document.getElementById('detalhesEndereco').textContent = `📍 ${item.endereco}`;
  document.getElementById('detalhesHorario').textContent = `🕐 ${item.horario || 'Horário não informado'}`;

  const telItem = document.getElementById('detalhesTelefoneItem');
  const telLink = document.getElementById('detalhesTelefone');
  if (item.telefone) { telLink.href = `tel:${item.telefone.replace(/\D/g, '')}`; telLink.textContent = `📞 ${item.telefone}`; telItem.hidden = false; }
  else telItem.hidden = true;

  const webItem = document.getElementById('detalhesWebsiteItem');
  const webLink = document.getElementById('detalhesWebsite');
  if (item.website) { webLink.href = item.website; webLink.textContent = `🌐 ${item.website.replace(/^https?:\/\//, '')}`; webItem.hidden = false; }
  else webItem.hidden = true;

  document.getElementById('detalhesDescricao').textContent = item.descricao || '';
  document.getElementById('detalhesDescricao').hidden = !item.descricao;

  document.getElementById('detalhesComoChegar').href = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;

  const btnFav = document.getElementById('detalhesBtnFavorito');
  const ehFavorito = favoritos.has(item.id);
  btnFav.classList.toggle('is-favorito', ehFavorito);
  btnFav.dataset.favorito = item.id;
  btnFav.setAttribute('aria-pressed', String(ehFavorito));

  document.getElementById('detalhesAvaliar').onclick = () => abrirDialogAvaliacao(item.id);
  document.getElementById('detalhesCompartilhar').onclick = () => compartilharEstabelecimento(item);

  registrarVisitaNoHistorico(item.id);
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

async function compartilharEstabelecimento(item) {
  const url = `${window.location.origin}${window.location.pathname}#estabelecimento-${item.id}`;
  const dados = { title: `${item.nome} · Glória em Movimento`, text: `Dá uma olhada: ${item.nome}`, url };
  if (navigator.share) {
    try { await navigator.share(dados); } catch { /* usuário cancelou, tudo bem */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    mostrarAviso('Link copiado!');
  } catch {
    mostrarAviso('Não foi possível copiar o link automaticamente. Copie da barra de endereço.');
  }
}

function initDialogDetalhes() {
  document.getElementById('detalhesBtnFavorito')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const resultado = await alternarFavorito(btn.dataset.favorito);
    if (!resultado.ok) return;
    btn.classList.toggle('is-favorito', resultado.favoritado);
    btn.setAttribute('aria-pressed', String(resultado.favoritado));
    renderizarResultados();
  });
  // Delegado no documento: o popup do Leaflet é inserido dinamicamente no DOM.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-popup-detalhes]');
    if (btn) abrirDialogDetalhes(btn.dataset.popupDetalhes);
  });
}

function initMapaProximos() {
  document.getElementById('mapaProximosLista')?.addEventListener('click', (e) => {
    const card = e.target.closest('.proximo-card');
    if (!card) return;
    const item = ESTABELECIMENTOS.find(i => i.id === card.dataset.id);
    if (!item) return;
    abrirDialogDetalhes(item.id);
    if (mapaInstancia) mapaInstancia.setView([item.lat, item.lng], 17);
  });
}

function initListaResultados() {
  const lista = document.getElementById('listaResultados');
  lista?.addEventListener('click', async (e) => {
    const chegarLink = e.target.closest('.acao-chegar');
    if (chegarLink) {
      const card = chegarLink.closest('[data-id]');
      if (card) registrarVisitaNoHistorico(card.dataset.id);
      // não retorna: deixa o link abrir normalmente em nova aba
    }

    const favBtn = e.target.closest('[data-favorito]');
    if (favBtn) {
      const id = favBtn.dataset.favorito;
      favBtn.disabled = true;
      const resultado = await alternarFavorito(id);
      favBtn.disabled = false;
      if (!resultado.ok) return;
      if (estado.modoFavoritos) { renderizarResultados(); return; }
      favBtn.classList.toggle('is-favorito', resultado.favoritado);
      favBtn.setAttribute('aria-pressed', String(resultado.favoritado));
      favBtn.setAttribute('aria-label', resultado.favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
      return;
    }
    const avaliarBtn = e.target.closest('[data-avaliar]');
    if (avaliarBtn) {
      abrirDialogAvaliacao(avaliarBtn.dataset.avaliar);
      return;
    }
    const detalhesBtn = e.target.closest('[data-detalhes]');
    if (detalhesBtn) {
      abrirDialogDetalhes(detalhesBtn.dataset.detalhes);
    }
  });
}

/* ---------------------------------------------------------
   Mapa (Leaflet, carregado sob demanda)
   --------------------------------------------------------- */
let mapaInstancia = null;
let marcadoresLayer = null;
let marcadorUsuario = null;
let circuloPrecisao = null;

// Leaflet 1.9.4 hospedado no próprio site (/vendor/leaflet/), com SRI: o navegador recusa o arquivo se o conteúdo mudar.
const LEAFLET_CSS_URL = '/vendor/leaflet/leaflet.css';
const LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const LEAFLET_JS_URL = '/vendor/leaflet/leaflet.js';
const LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

function carregarScript(src, integrity) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.defer = true; s.onload = resolve; s.onerror = reject;
    if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
    document.head.appendChild(s);
  });
}
function carregarCSS(href, integrity) {
  return new Promise((resolve, reject) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.onload = resolve; l.onerror = reject;
    if (integrity) { l.integrity = integrity; l.crossOrigin = 'anonymous'; }
    document.head.appendChild(l);
  });
}

let camadaMapaAtual = null;

async function inicializarMapa() {
  const container = document.getElementById('mapaGloria');
  const skeleton = document.getElementById('mapaSkeleton');
  if (!container || mapaInstancia) return mapaInstancia;

  try {
    await carregarCSS(LEAFLET_CSS_URL, LEAFLET_CSS_SRI);
    await carregarScript(LEAFLET_JS_URL, LEAFLET_JS_SRI);

    // eslint-disable-next-line no-undef
    mapaInstancia = L.map(container, { scrollWheelZoom: false, zoomControl: false, zoomSnap: 0.5, minZoom: 13, attributionControl: true })
      .setView([CENTRO_BAIRRO.lat, CENTRO_BAIRRO.lng], 15);
    L.control.zoom({ position: 'bottomright' }).addTo(mapaInstancia);

    const attrMapa = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
    const estiloTiles = () => document.documentElement.getAttribute('data-tema') === 'escuro' ? 'dark_all' : 'rastertiles/voyager';
    const urlTiles = () => `https://{s}.basemaps.cartocdn.com/${estiloTiles().startsWith('dark') ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}{r}.png`;
    const criarTiles = () => L.tileLayer(urlTiles(), { maxZoom: 19, subdomains: 'abcd', attribution: attrMapa });
    camadaMapaAtual = criarTiles().addTo(mapaInstancia);
    // Troca o mapa claro/escuro junto com o tema do site
    new MutationObserver(() => {
      if (camadaMapaAtual) mapaInstancia.removeLayer(camadaMapaAtual);
      camadaMapaAtual = criarTiles().addTo(mapaInstancia);
      camadaMapaAtual.bringToBack();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

    marcadoresLayer = L.layerGroup().addTo(mapaInstancia);
    atualizarMarcadoresMapa(obterResultados());
    observarRedimensionamentoDoMapa(container);
  } catch (err) {
    container.innerHTML = '<p style="padding:1rem">Não foi possível carregar o mapa. Verifique sua conexão.</p>';
    console.error('Erro ao carregar mapa:', err);
  } finally {
    skeleton?.remove();
  }
  return mapaInstancia;
}

/* Leaflet só calcula o tamanho do container uma vez, na criação do mapa.
   Se a tela for redimensionada depois (girar o celular, redimensionar a
   janela, ou o layout mudar de coluna nos breakpoints do CSS), o mapa fica
   com o tamanho antigo — tiles cortados e área cinza sobrando. O
   ResizeObserver avisa o Leaflet toda vez que o container muda de tamanho. */
function observarRedimensionamentoDoMapa(container) {
  if (!('ResizeObserver' in window)) {
    window.addEventListener('resize', () => mapaInstancia?.invalidateSize());
    return;
  }
  let temporizador = null;
  const observer = new ResizeObserver(() => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => mapaInstancia?.invalidateSize(), 120);
  });
  observer.observe(container);
}

function iconeMarcador(categoriaId) {
  const cat = CATEGORIA_POR_ID[categoriaId] || { cor: '#22C55E' };
  return L.divIcon({
    className: 'marcador-categoria',
    html: `<span class="mk" style="--mk:${cat.cor}"><i></i></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function atualizarMarcadoresMapa(itens) {
  if (!marcadoresLayer || typeof L === 'undefined') return;
  marcadoresLayer.clearLayers();
  itens.forEach(item => {
    const cat = CATEGORIA_POR_ID[item.categoria];
    const nome = escaparHTML(item.nome);
    const distancia = item._distancia != null ? formatarDistancia(item._distancia) : '';
    const notaTexto = typeof item.avaliacao === 'number' ? `★ ${item.avaliacao.toFixed(1)} (${item.avaliacoes ?? 0})` : 'Sem avaliações';
    const linkChegar = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
    const conteudoPopup = `
      <div class="popup-marcador">
        ${item.fotoUrl ? `<img src="${item.fotoUrl}" alt="${nome}" loading="lazy" data-fallback-categoria="${escaparAtributo(item.categoria)}">` : ''}
        <strong>${nome}</strong>
        ${statusAbertoHTML(item.horario)}
        <div class="popup-linha"><span>${escaparHTML(cat?.label || '')}</span><span>${distancia}</span></div>
        <div class="popup-linha"><span>${notaTexto}</span></div>
        <button type="button" class="btn-primario" data-popup-detalhes="${item.id}">Ver detalhes</button>
      </div>`;
    L.marker([item.lat, item.lng], { icon: iconeMarcador(item.categoria) })
      .addTo(marcadoresLayer)
      .bindPopup(conteudoPopup);
  });
}

function renderizarProximosNoMapa(resultados) {
  const wrap = document.getElementById('mapaProximosLista');
  if (!wrap) return;
  const proximos = resultados.slice(0, 8);
  wrap.innerHTML = proximos.map(item => {
    const cat = CATEGORIA_POR_ID[item.categoria];
    const nome = escaparHTML(item.nome);
    const imagem = item.fotoUrl
      ? `<img src="${item.fotoUrl}" alt="${nome}" loading="lazy" data-fallback-categoria="${escaparAtributo(item.categoria)}">`
      : `<span class="categoria-icone-fundo" style="background:${cat?.corBg || 'var(--color-primary-bg)'};color:${cat?.cor || 'var(--color-primary)'}"><svg viewBox="0 0 24 24" width="28" height="28">${ICONES[item.categoria] || ''}</svg></span>`;
    return `
      <button type="button" class="proximo-card" data-id="${item.id}">
        ${imagem}
        <div class="proximo-card-corpo">
          <h4>${nome}</h4>
          <div class="proximo-card-linha"><span>${escaparHTML(cat?.label || '')}</span><span>${formatarDistancia(item._distancia)}</span></div>
        </div>
      </button>`;
  }).join('');
}

function initMapaLazy() {
  const alvo = document.querySelector('.mapa-card');
  if (!alvo || !('IntersectionObserver' in window)) { inicializarMapa(); return; }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { inicializarMapa(); observer.disconnect(); }
    });
  }, { rootMargin: '200px' });
  observer.observe(alvo);
}

/* ---------------------------------------------------------
   Localização em tempo real
   --------------------------------------------------------- */
let watchId = null;

function initLocalizacao() {
  document.getElementById('btnAtivarLocalizacao')?.addEventListener('click', alternarLocalizacao);
  document.getElementById('btnMinhaLocalizacaoMapa')?.addEventListener('click', alternarLocalizacao);
}

async function alternarLocalizacao() {
  const status = document.getElementById('statusLocalizacao');
  const btn = document.getElementById('btnAtivarLocalizacao');

  if (watchId !== null) {
    pararLocalizacao();
    if (status) status.textContent = 'Compartilhamento de localização interrompido.';
    return;
  }

  if (!('geolocation' in navigator)) {
    if (status) status.textContent = 'Seu navegador não é compatível com geolocalização.';
    return;
  }
  if (!window.isSecureContext) {
    if (status) status.textContent = 'A localização em tempo real só funciona em conexões seguras (HTTPS).';
    return;
  }

  if (status) status.textContent = 'Buscando sua localização…';
  await inicializarMapa();

  watchId = navigator.geolocation.watchPosition(
    (pos) => atualizarPosicaoUsuario(pos, status, btn),
    (err) => tratarErroLocalizacao(err, status),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}

function atualizarPosicaoUsuario(pos, status, btn) {
  const { latitude, longitude, accuracy } = pos.coords;
  estado.localizacaoUsuario = { lat: latitude, lng: longitude };

  if (mapaInstancia && typeof L !== 'undefined') {
    if (!marcadorUsuario) {
      const iconeUsuario = L.divIcon({ className: 'marcador-usuario', html: '<span class="pulso"></span><span class="ponto"></span>', iconSize: [18, 18] });
      marcadorUsuario = L.marker([latitude, longitude], { icon: iconeUsuario, zIndexOffset: 1000 }).addTo(mapaInstancia).bindPopup('Você está aqui');
      circuloPrecisao = L.circle([latitude, longitude], { radius: accuracy, color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.1, weight: 1, dashArray: '4 4' }).addTo(mapaInstancia);
      mapaInstancia.setView([latitude, longitude], 16);
    } else {
      marcadorUsuario.setLatLng([latitude, longitude]);
      circuloPrecisao.setLatLng([latitude, longitude]).setRadius(accuracy);
    }
  }

  document.getElementById('pillLocalizacao')?.removeAttribute('hidden');
  const tituloLoc = document.getElementById('tituloLocalizacao');
  const descLoc = document.getElementById('descricaoLocalizacao');
  if (tituloLoc) tituloLoc.textContent = 'Localização ativa';
  if (descLoc) descLoc.textContent = 'Os resultados estão ordenados pela distância até você.';
  atualizarBotoesLocalizacao(true);
  if (status) status.textContent = `Localização atualizada · precisão de ${Math.round(accuracy)} m`;

  const select = document.getElementById('selectOrdenar');
  if (select) select.value = 'proximidade';
  estado.ordenar = 'proximidade';
  renderizarResultados();
}

function tratarErroLocalizacao(err, status) {
  const mensagens = {
    1: 'Permissão de localização negada. Habilite o acesso à localização nas configurações do navegador.',
    2: 'Não foi possível obter sua localização no momento.',
    3: 'Tempo esgotado ao tentar obter sua localização.',
  };
  if (status) status.textContent = mensagens[err.code] || 'Erro ao obter localização.';
  pararLocalizacao();
}

function pararLocalizacao() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (mapaInstancia) {
    if (marcadorUsuario) { mapaInstancia.removeLayer(marcadorUsuario); marcadorUsuario = null; }
    if (circuloPrecisao) { mapaInstancia.removeLayer(circuloPrecisao); circuloPrecisao = null; }
  }
  estado.localizacaoUsuario = null;
  document.getElementById('pillLocalizacao')?.setAttribute('hidden', '');
  const tituloLoc = document.getElementById('tituloLocalizacao');
  const descLoc = document.getElementById('descricaoLocalizacao');
  if (tituloLoc) tituloLoc.textContent = 'Ative sua localização';
  if (descLoc) descLoc.textContent = 'para encontrarmos os comércios mais próximos de você.';
  atualizarBotoesLocalizacao(false);
  renderizarResultados();
}

function atualizarBotoesLocalizacao(ativo) {
  const htmlAtivo = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Parar de compartilhar';
  const htmlInativo = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z" fill="currentColor"/></svg> Ativar localização';
  const htmlInativoMapa = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z" fill="currentColor"/></svg> Minha localização';
  ['btnAtivarLocalizacao', 'btnMinhaLocalizacaoMapa'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('is-ativo', ativo);
    btn.innerHTML = ativo ? htmlAtivo : (id === 'btnMinhaLocalizacaoMapa' ? htmlInativoMapa : htmlInativo);
  });
}

/* ---------------------------------------------------------
   Estado de conexão
   --------------------------------------------------------- */
function initStatusOffline() {
  const toast = document.getElementById('toastOffline');
  if (!toast) return;
  const atualizar = () => { toast.hidden = navigator.onLine; };
  window.addEventListener('online', atualizar);
  window.addEventListener('offline', atualizar);
  atualizar();
}

/* ---------------------------------------------------------
   PWA — service worker (arquivo separado sw.js na raiz do site)
   --------------------------------------------------------- */
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Falha ao registrar o service worker:', err);
      });
    });
  }
}

/* ---------------------------------------------------------
   Init
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Cada init roda isolado: se uma falhar, as outras continuam — uma única
  // parte quebrada (ex.: um recurso do navegador ausente) não deve deixar
  // a página inteira em branco.
  const passos = [
    initTema, initMenu, initNavConta, initCategorias, initBusca,
    initOrdenacao, initListaResultados, initMapaProximos, initDialogDetalhes, initAvaliacao, initHistorico,
    atualizarCategoriasAtivas, initMapaLazy, initLocalizacao, initPWA, initStatusOffline,
  ];
  for (const passo of passos) {
    try { passo(); } catch (err) { console.error(`Falha ao iniciar ${passo.name}:`, err); }
  }

  // Busca os estabelecimentos reais no Supabase (renderiza ao terminar).
  if (typeof supabaseClient !== 'undefined') {
    carregarEstabelecimentos();
  } else {
    estabelecimentosCarregados = true;
    estabelecimentosComErro = true;
    renderizarResultados();
  }

  // auth.js dispara isso a cada login/logout — recarrega favoritos e re-renderiza.
  window.addEventListener('gloria:auth-mudou', async () => {
    await recarregarFavoritos();
    renderizarResultados();
  });
});
