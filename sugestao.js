'use strict';

/**
 * Formulário público "Sugerir comércio".
 *
 * Qualquer pessoa pode enviar uma sugestão (inclusive sem conta). A sugestão
 * é gravada como "pendente" na tabela `solicitacoes_estabelecimento` e só
 * aparece no mapa depois que o admin aprovar (ver /admin/).
 *
 * Proteções: validação no navegador (só para ajudar quem preenche), campo
 * armadilha contra robôs e teto global de envios no próprio banco (ver
 * supabase/migracao-solicitacoes.sql). A validação de verdade acontece no banco.
 */

(function () {
  const dialog = document.getElementById('dialogSugestao');
  const form = document.getElementById('formSugestao');
  if (!dialog || !form) return;

  const selectCategoria = document.getElementById('sugestaoCategoria');
  const erroEl = document.getElementById('erroSugestao');
  const sucessoEl = document.getElementById('sucessoSugestao');
  const btnEnviar = form.querySelector('button[type="submit"]');
  const textoBotaoOriginal = btnEnviar.textContent;

  // Categorias vêm da mesma lista usada no site (definida em app.js).
  function preencherCategorias() {
    if (typeof CATEGORIAS === 'undefined') return;
    selectCategoria.innerHTML = '<option value="">Escolha uma categoria</option>' +
      CATEGORIAS.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  }

  function limparMensagens() {
    erroEl.textContent = '';
    sucessoEl.textContent = '';
  }

  function abrir(e) {
    e?.preventDefault();
    limparMensagens();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    document.getElementById('sugestaoNome')?.focus();
  }

  // Normaliza o site: aceita "instagram.com/x" e transforma em https://...
  function normalizarSite(valor) {
    if (!valor) return null;
    const limpo = valor.trim();
    if (!limpo) return null;
    const comProtocolo = /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`;
    try {
      const url = new URL(comProtocolo);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  }

  function valorOuNulo(valor) {
    const limpo = (valor || '').toString().trim();
    return limpo ? limpo : null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparMensagens();

    const dados = new FormData(form);

    // Campo armadilha preenchido = quase certeza que é robô. Finge que deu certo
    // e não envia nada.
    if ((dados.get('site_confirmacao') || '').toString().trim() !== '') {
      form.reset();
      sucessoEl.textContent = 'Obrigado! Recebemos sua sugestão.';
      return;
    }

    const nome = valorOuNulo(dados.get('nome'));
    const categoria = valorOuNulo(dados.get('categoria'));
    const endereco = valorOuNulo(dados.get('endereco'));

    if (!nome || nome.length < 2) { erroEl.textContent = 'Informe o nome do comércio.'; return; }
    if (!categoria) { erroEl.textContent = 'Escolha uma categoria.'; return; }
    if (!endereco || endereco.length < 5) { erroEl.textContent = 'Informe o endereço completo (rua e número).'; return; }

    const siteTexto = valorOuNulo(dados.get('site'));
    const site = normalizarSite(siteTexto);
    if (siteTexto && !site) { erroEl.textContent = 'O site ou Instagram informado não parece válido.'; return; }

    if (typeof supabaseClient === 'undefined') {
      erroEl.textContent = 'Não foi possível conectar agora. Tente novamente em instantes.';
      return;
    }

    const registro = {
      nome,
      categoria_id: categoria,
      endereco,
      telefone: valorOuNulo(dados.get('telefone')),
      horario: valorOuNulo(dados.get('horario')),
      site,
      descricao: valorOuNulo(dados.get('descricao')),
      nome_solicitante: valorOuNulo(dados.get('nome_solicitante')),
      contato_solicitante: valorOuNulo(dados.get('contato_solicitante')),
    };

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando…';

    // Sem .select() de propósito: a pessoa não precisa (nem pode) ler o que enviou.
    const { error } = await supabaseClient
      .from('solicitacoes_estabelecimento')
      .insert(registro);

    btnEnviar.disabled = false;
    btnEnviar.textContent = textoBotaoOriginal;

    if (error) {
      console.error('Erro ao enviar sugestão:', error);
      erroEl.textContent = (error.message || '').includes('Muitas sugestões')
        ? 'Recebemos muitas sugestões em pouco tempo. Tente de novo daqui a pouco.'
        : 'Não foi possível enviar agora. Confira os campos e tente novamente.';
      return;
    }

    form.reset();
    preencherCategorias();
    sucessoEl.textContent = 'Obrigado! Sua sugestão foi enviada. Vamos conferir e publicar no mapa em breve.';
  });

  // Abertura: botão do painel, link do menu (desktop e celular)
  document.getElementById('btnAbrirSugestao')?.addEventListener('click', abrir);
  document.getElementById('linkSugerir')?.addEventListener('click', abrir);
  document.getElementById('linkSugerirMobile')?.addEventListener('click', (e) => {
    document.getElementById('menuMobile')?.setAttribute('hidden', '');
    document.getElementById('btnMenu')?.setAttribute('aria-expanded', 'false');
    abrir(e);
  });

  preencherCategorias();
})();
