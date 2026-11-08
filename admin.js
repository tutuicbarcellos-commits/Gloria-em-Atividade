'use strict';

/**
 * Painel administrativo (/admin/).
 *
 * Segurança: este arquivo é público (qualquer pessoa pode lê-lo). Por isso NÃO
 * há senha nem atalho aqui. O acesso vale pelo login real do Supabase + o papel
 * `admin` na tabela `profiles`, e cada operação é validada de novo pelo banco
 * (políticas RLS e funções aprovar_/recusar_solicitacao). Esconder o painel
 * no navegador não é a proteção; a proteção é o banco.
 */

(function () {
  const $ = (id) => document.getElementById(id);

  let categorias = [];
  let adminAtualId = null;      // id do admin cujo painel já está carregado
  let comerciosCache = [];      // cópia da lista para o filtro

  /* ---------------------------------------------------------
     Utilidades
     --------------------------------------------------------- */
  function esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function urlHttps(valor) {
    if (!valor) return null;
    return /^https?:\/\//i.test(valor) ? valor : null;
  }

  function toast(mensagem) {
    const el = $('adminToast');
    el.textContent = mensagem;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 3400);
  }

  function traduzirErroLogin(msg) {
    const mapa = {
      'Invalid login credentials': 'E-mail ou senha incorretos.',
      'Email not confirmed': 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).',
    };
    return mapa[msg] || msg || 'Não foi possível entrar. Tente novamente.';
  }

  // Lê coordenadas de "-30.07, -51.19" ou de um link do Google Maps (@lat,lng)
  function lerCoordenadas(texto) {
    const limpo = String(texto || '').trim();
    if (!limpo) return null;
    let m = limpo.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/);
    if (!m) m = limpo.match(/(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  }

  // Confere se as coordenadas caem perto do bairro (ajuda a pegar erro de digitação)
  function dentroDeAreaProxima({ lat, lng }) {
    return lat >= -30.3 && lat <= -29.9 && lng >= -51.4 && lng <= -51.0;
  }

  function coordenadasValidas(texto) {
    const c = lerCoordenadas(texto);
    if (!c) return { ok: false, erro: 'Coordenadas inválidas. Use o formato "-30.0731, -51.1995".' };
    if (!dentroDeAreaProxima(c) && !window.confirm('Essas coordenadas ficam longe de Porto Alegre. Tem certeza?')) {
      return { ok: false, erro: 'Confira as coordenadas e tente de novo.' };
    }
    return { ok: true, lat: c.lat, lng: c.lng };
  }

  function linkGoogleMaps(endereco) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${endereco}, Porto Alegre, RS`)}`;
  }

  function dataCurta(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function nomeCategoria(id) {
    return categorias.find((c) => c.id === id)?.nome || id;
  }

  function opcoesCategorias(selecionada) {
    return categorias.map((c) =>
      `<option value="${esc(c.id)}" ${c.id === selecionada ? 'selected' : ''}>${esc(c.nome)}</option>`
    ).join('');
  }

  /* ---------------------------------------------------------
     Vistas e acesso
     --------------------------------------------------------- */
  const VISTAS = ['adminCarregando', 'adminLogin', 'adminSemPermissao', 'adminPainel'];
  function mostrarVista(id) {
    VISTAS.forEach((v) => { $(v).hidden = v !== id; });
  }

  async function decidirAcesso(session) {
    if (!session) {
      adminAtualId = null;
      $('adminUsuario').hidden = true;
      $('adminBtnSair').hidden = true;
      mostrarVista('adminLogin');
      return;
    }

    const { data: perfil, error } = await supabaseClient
      .from('profiles')
      .select('nome, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !perfil || perfil.role !== 'admin') {
      adminAtualId = null;
      $('adminSemPermissaoEmail').textContent = session.user.email || 'sua conta';
      mostrarVista('adminSemPermissao');
      return;
    }

    $('adminUsuario').textContent = perfil.nome || session.user.email;
    $('adminUsuario').hidden = false;
    $('adminBtnSair').hidden = false;
    mostrarVista('adminPainel');

    if (adminAtualId === session.user.id) return; // já carregado
    adminAtualId = session.user.id;
    await carregarCategorias();
    await Promise.all([carregarSolicitacoes(), carregarComercios()]);
  }

  /* ---------------------------------------------------------
     Login e logout
     --------------------------------------------------------- */
  function iniciarLogin() {
    $('formAdminLogin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erro = $('adminErroLogin');
      const btn = e.target.querySelector('button[type="submit"]');
      erro.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Entrando…';
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: $('adminEmail').value.trim(),
        password: $('adminSenha').value,
      });
      btn.disabled = false;
      btn.textContent = 'Entrar';
      if (error) {
        erro.textContent = traduzirErroLogin(error.message);
        return;
      }
      $('adminSenha').value = '';
      // o onAuthStateChange abaixo é que decide o que mostrar
    });
  }

  async function sair() {
    await supabaseClient.auth.signOut();
  }

  /* ---------------------------------------------------------
     Abas
     --------------------------------------------------------- */
  function iniciarAbas() {
    document.querySelectorAll('.admin-aba').forEach((aba) => {
      aba.addEventListener('click', () => {
        document.querySelectorAll('.admin-aba').forEach((b) => {
          const ativa = b === aba;
          b.classList.toggle('is-ativa', ativa);
          b.setAttribute('aria-selected', String(ativa));
        });
        $('painelSolicitacoes').hidden = aba.dataset.aba !== 'solicitacoes';
        $('painelComercios').hidden = aba.dataset.aba !== 'comercios';
      });
    });
  }

  /* ---------------------------------------------------------
     Dados básicos
     --------------------------------------------------------- */
  async function carregarCategorias() {
    const { data, error } = await supabaseClient.from('categorias').select('id, nome, ordem').order('ordem');
    if (error) { console.error(error); toast('Não foi possível carregar as categorias.'); return; }
    categorias = data || [];
    $('novoCategoria').innerHTML = opcoesCategorias();
  }

  function atualizarResumo(pendentes, comercios) {
    $('statPendentes').textContent = pendentes;
    $('statAtivos').textContent = comercios.filter((c) => c.ativo).length;
    $('statTotal').textContent = comercios.length;
  }

  /* ---------------------------------------------------------
     Sugestões (solicitações)
     --------------------------------------------------------- */
  let solicitacoesCache = [];

  async function carregarSolicitacoes() {
    const lista = $('listaSolicitacoes');
    const { data, error } = await supabaseClient
      .from('solicitacoes_estabelecimento')
      .select('*')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false });

    if (error) {
      console.error(error);
      lista.innerHTML = '<p class="form-erro">Não foi possível carregar as sugestões.</p>';
      return;
    }
    solicitacoesCache = data || [];
    $('btnAbaSolicitacoes').textContent = solicitacoesCache.length
      ? `Sugestões dos usuários (${solicitacoesCache.length})`
      : 'Sugestões dos usuários';
    $('semSolicitacoes').hidden = solicitacoesCache.length > 0;
    lista.innerHTML = solicitacoesCache.map(cardSolicitacao).join('');
    atualizarResumo(solicitacoesCache.length, comerciosCache);
  }

  function cardSolicitacao(s) {
    const solicitante = [s.nome_solicitante, s.contato_solicitante].filter(Boolean).join(' · ');
    const site = urlHttps(s.site);
    const linha = (rotulo, valor) => valor ? `<div><dt>${rotulo}</dt><dd>${valor}</dd></div>` : '';

    return `
      <article class="admin-cartao-item" data-id="${esc(s.id)}">
        <header class="item-topo">
          <div>
            <h3>${esc(s.nome)}</h3>
            <span class="tag">${esc(nomeCategoria(s.categoria_id))}</span>
          </div>
          <time class="item-data" datetime="${esc(s.criado_em)}">${esc(dataCurta(s.criado_em))}</time>
        </header>

        <dl class="item-dados">
          ${linha('Endereço', esc(s.endereco))}
          ${linha('Telefone', s.telefone ? esc(s.telefone) : '')}
          ${linha('Horário', s.horario ? esc(s.horario) : '')}
          ${linha('Site / Instagram', site ? `<a href="${esc(site)}" target="_blank" rel="noopener noreferrer">${esc(site)}</a>` : '')}
          ${linha('Sobre', s.descricao ? esc(s.descricao) : '')}
          <div><dt>Sugerido por</dt><dd>${solicitante ? esc(solicitante) : '<span class="suave">Não informado</span>'}</dd></div>
        </dl>

        <div class="item-acoes">
          <a class="btn-secundario btn-compacto" href="${esc(linkGoogleMaps(s.endereco))}" target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a>
          <button type="button" class="btn-primario btn-compacto" data-acao="abrir-aprovacao">Aprovar e publicar</button>
          <button type="button" class="btn-perigo btn-compacto" data-acao="recusar">Recusar</button>
        </div>

        <form class="form-aprovacao form-auth" hidden>
          <p class="dica-coordenadas">
            <strong>Como pegar as coordenadas:</strong> no Google Maps, clique com o botão direito sobre o local.
            No topo do menu aparecem a latitude e a longitude. Clique nelas para copiar e cole abaixo.
          </p>
          <div class="admin-form-grid">
            <div class="campo-largo">
              <label>Coordenadas (lat, lng) *</label>
              <input type="text" name="coordenadas" required placeholder="-30.0731, -51.1995" maxlength="80">
            </div>
            <div class="campo-largo">
              <label>Nome</label>
              <input type="text" name="nome" value="${esc(s.nome)}" required maxlength="120">
            </div>
            <div>
              <label>Categoria</label>
              <select name="categoria_id" required>${opcoesCategorias(s.categoria_id)}</select>
            </div>
            <div>
              <label>Telefone</label>
              <input type="text" name="telefone" value="${esc(s.telefone || '')}" maxlength="40">
            </div>
            <div class="campo-largo">
              <label>Endereço</label>
              <input type="text" name="endereco" value="${esc(s.endereco)}" required maxlength="200">
            </div>
            <div>
              <label>Horário</label>
              <input type="text" name="horario" value="${esc(s.horario || '')}" maxlength="200">
            </div>
            <div>
              <label>Sobre</label>
              <input type="text" name="descricao" value="${esc(s.descricao || '')}" maxlength="500">
            </div>
          </div>
          <div class="item-acoes">
            <button type="submit" class="btn-primario btn-compacto">Publicar no mapa</button>
            <button type="button" class="btn-secundario btn-compacto" data-acao="fechar-aprovacao">Cancelar</button>
          </div>
          <p class="form-erro" data-erro role="alert" aria-live="assertive"></p>
        </form>
      </article>`;
  }

  function iniciarSolicitacoes() {
    const lista = $('listaSolicitacoes');

    lista.addEventListener('click', async (e) => {
      const botao = e.target.closest('[data-acao]');
      if (!botao) return;
      const card = botao.closest('[data-id]');
      const acao = botao.dataset.acao;

      if (acao === 'abrir-aprovacao') {
        const form = card.querySelector('.form-aprovacao');
        form.hidden = false;
        form.querySelector('[name="coordenadas"]').focus();
        return;
      }
      if (acao === 'fechar-aprovacao') {
        card.querySelector('.form-aprovacao').hidden = true;
        return;
      }
      if (acao === 'recusar') {
        const nome = card.querySelector('h3')?.textContent || 'esta sugestão';
        if (!window.confirm(`Recusar "${nome}"? Ela sai da fila e não aparece no mapa.`)) return;
        botao.disabled = true;
        const { error } = await supabaseClient.rpc('recusar_solicitacao', { p_id: card.dataset.id });
        if (error) { botao.disabled = false; toast(error.message || 'Não foi possível recusar.'); return; }
        toast('Sugestão recusada.');
        await carregarSolicitacoes();
      }
    });

    lista.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      if (!form.classList.contains('form-aprovacao')) return;
      const card = form.closest('[data-id]');
      const erroEl = form.querySelector('[data-erro]');
      const btn = form.querySelector('button[type="submit"]');
      erroEl.textContent = '';

      const coord = coordenadasValidas(form.querySelector('[name="coordenadas"]').value);
      if (!coord.ok) { erroEl.textContent = coord.erro; return; }

      const campo = (nome) => form.querySelector(`[name="${nome}"]`).value.trim() || null;
      const original = solicitacoesCache.find((s) => s.id === card.dataset.id);

      btn.disabled = true;
      btn.textContent = 'Publicando…';
      const { data, error } = await supabaseClient.rpc('aprovar_solicitacao', {
        p_id: card.dataset.id,
        p_latitude: coord.lat,
        p_longitude: coord.lng,
        p_nome: campo('nome'),
        p_categoria_id: campo('categoria_id'),
        p_endereco: campo('endereco'),
        p_telefone: campo('telefone'),
        p_horario: campo('horario'),
        p_site: original?.site || null,
        p_descricao: campo('descricao'),
      });
      btn.disabled = false;
      btn.textContent = 'Publicar no mapa';

      if (error) { erroEl.textContent = error.message || 'Não foi possível publicar.'; return; }
      toast('Comércio publicado no mapa.');
      await Promise.all([carregarSolicitacoes(), carregarComercios()]);
    });

    $('btnAtualizarSolicitacoes').addEventListener('click', carregarSolicitacoes);
  }

  /* ---------------------------------------------------------
     Comércios cadastrados (editar, ativar/desativar, adicionar)
     --------------------------------------------------------- */
  async function carregarComercios() {
    const { data, error } = await supabaseClient
      .from('estabelecimentos')
      .select('*')
      .order('nome');
    if (error) {
      console.error(error);
      $('listaComercios').innerHTML = '<p class="form-erro">Não foi possível carregar os comércios.</p>';
      return;
    }
    comerciosCache = data || [];
    renderizarComercios();
    atualizarResumo(solicitacoesCache.length, comerciosCache);
  }

  function renderizarComercios() {
    const termo = $('filtroComercios').value.trim().toLowerCase();
    const filtrados = comerciosCache.filter((c) =>
      !termo || c.nome.toLowerCase().includes(termo) || (c.endereco || '').toLowerCase().includes(termo)
    );
    $('listaComercios').innerHTML = filtrados.length
      ? filtrados.map(itemComercio).join('')
      : '<p class="admin-vazio">Nenhum comércio encontrado.</p>';
  }

  function itemComercio(c) {
    return `
      <article class="admin-cartao-item ${c.ativo ? '' : 'is-inativo'}" data-id="${esc(c.id)}">
        <header class="item-topo">
          <div>
            <h3>${esc(c.nome)}</h3>
            <span class="tag">${esc(nomeCategoria(c.categoria_id))}</span>
            ${c.ativo ? '' : '<span class="tag tag-alerta">Oculto do site</span>'}
          </div>
          <span class="item-coord">${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}</span>
        </header>
        <form class="form-comercio form-auth admin-form-grid">
          <div class="campo-largo">
            <label>Nome</label>
            <input type="text" name="nome" value="${esc(c.nome)}" required maxlength="120">
          </div>
          <div>
            <label>Categoria</label>
            <select name="categoria_id" required>${opcoesCategorias(c.categoria_id)}</select>
          </div>
          <div>
            <label>Telefone</label>
            <input type="text" name="telefone" value="${esc(c.telefone || '')}" maxlength="40">
          </div>
          <div class="campo-largo">
            <label>Endereço</label>
            <input type="text" name="endereco" value="${esc(c.endereco)}" required maxlength="200">
          </div>
          <div>
            <label>Horário</label>
            <input type="text" name="horario" value="${esc(c.horario || '')}" maxlength="200">
          </div>
          <div>
            <label>Foto (link https)</label>
            <input type="url" name="foto_url" value="${esc(c.foto_url || '')}" maxlength="500" placeholder="https://...">
          </div>
          <div>
            <label>Coordenadas (lat, lng)</label>
            <input type="text" name="coordenadas" value="${esc(`${c.latitude}, ${c.longitude}`)}" required maxlength="80">
          </div>
          <div class="campo-largo item-acoes">
            <label class="check"><input type="checkbox" name="ativo" ${c.ativo ? 'checked' : ''}> Visível no site</label>
            <button type="submit" class="btn-primario btn-compacto">Salvar</button>
          </div>
          <p class="form-erro" data-erro role="alert" aria-live="assertive"></p>
        </form>
      </article>`;
  }

  function iniciarComercios() {
    $('filtroComercios').addEventListener('input', renderizarComercios);

    $('listaComercios').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const card = form.closest('[data-id]');
      const erroEl = form.querySelector('[data-erro]');
      const btn = form.querySelector('button[type="submit"]');
      erroEl.textContent = '';

      const coord = coordenadasValidas(form.querySelector('[name="coordenadas"]').value);
      if (!coord.ok) { erroEl.textContent = coord.erro; return; }

      const foto = form.querySelector('[name="foto_url"]').value.trim();
      if (foto && !urlHttps(foto)) { erroEl.textContent = 'A foto precisa ser um link que comece com https://'; return; }

      const atualizacao = {
        nome: form.querySelector('[name="nome"]').value.trim(),
        categoria_id: form.querySelector('[name="categoria_id"]').value,
        endereco: form.querySelector('[name="endereco"]').value.trim(),
        telefone: form.querySelector('[name="telefone"]').value.trim() || null,
        horario: form.querySelector('[name="horario"]').value.trim() || null,
        foto_url: foto || null,
        latitude: coord.lat,
        longitude: coord.lng,
        ativo: form.querySelector('[name="ativo"]').checked,
        atualizado_em: new Date().toISOString(),
      };

      btn.disabled = true;
      btn.textContent = 'Salvando…';
      const { error } = await supabaseClient.from('estabelecimentos').update(atualizacao).eq('id', card.dataset.id);
      btn.disabled = false;
      btn.textContent = 'Salvar';

      if (error) { erroEl.textContent = 'Não foi possível salvar. Confira os campos.'; console.error(error); return; }
      toast('Alterações salvas.');
      await carregarComercios();
    });

    $('formNovoComercio').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const erroEl = $('novoComercioErro');
      const btn = form.querySelector('button[type="submit"]');
      erroEl.textContent = '';

      const coord = coordenadasValidas($('novoCoordenadas').value);
      if (!coord.ok) { erroEl.textContent = coord.erro; return; }
      const foto = $('novoFoto').value.trim();
      if (foto && !urlHttps(foto)) { erroEl.textContent = 'A foto precisa ser um link que comece com https://'; return; }

      const { data: { user } } = await supabaseClient.auth.getUser();
      const registro = {
        nome: $('novoNome').value.trim(),
        categoria_id: $('novoCategoria').value,
        endereco: $('novoEndereco').value.trim(),
        telefone: $('novoTelefone').value.trim() || null,
        horario: $('novoHorario').value.trim() || null,
        foto_url: foto || null,
        latitude: coord.lat,
        longitude: coord.lng,
        ativo: true,
        criado_por: user?.id,
      };

      btn.disabled = true;
      btn.textContent = 'Publicando…';
      const { error } = await supabaseClient.from('estabelecimentos').insert(registro);
      btn.disabled = false;
      btn.textContent = 'Publicar no mapa';

      if (error) { erroEl.textContent = 'Não foi possível publicar. Confira os campos.'; console.error(error); return; }
      form.reset();
      toast('Comércio publicado no mapa.');
      await carregarComercios();
    });
  }

  /* ---------------------------------------------------------
     Inicialização
     --------------------------------------------------------- */
  function iniciar() {
    if (typeof supabaseClient === 'undefined') {
      $('adminCarregando').textContent = 'Não foi possível conectar ao banco de dados. Recarregue a página.';
      return;
    }

    iniciarLogin();
    iniciarAbas();
    iniciarSolicitacoes();
    iniciarComercios();
    $('adminBtnSair').addEventListener('click', sair);
    $('adminSairSemPermissao').addEventListener('click', sair);

    // Mudanças de sessão (entrar/sair). Adiado com setTimeout para não chamar o
    // Supabase de dentro do próprio callback de autenticação.
    supabaseClient.auth.onAuthStateChange((evento, session) => {
      if (evento === 'SIGNED_OUT' || evento === 'SIGNED_IN') {
        setTimeout(() => decidirAcesso(session), 0);
      }
    });

    supabaseClient.auth.getSession()
      .then(({ data }) => decidirAcesso(data.session))
      .catch((err) => {
        console.error(err);
        decidirAcesso(null);
      });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
