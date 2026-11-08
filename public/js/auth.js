'use strict';

/**
 * Autenticação real via Supabase Auth. Este arquivo cuida só de
 * login/cadastro/logout/sessão/perfil — favoritos e avaliações
 * (que dependem de estar logado) ficam em app.js, que consulta
 * `usuarioAtual`/`perfilAtual` definidos aqui.
 */

let usuarioAtual = null;   // objeto de sessão do Supabase Auth (ou null)
let perfilAtual = null;    // linha da tabela profiles (ou null)

const MENSAGENS_ERRO = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Esse e-mail já tem uma conta. Tente entrar.',
  'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).',
  'Unable to validate email address: invalid format': 'E-mail em formato inválido.',
};
function traduzirErro(msg) {
  return MENSAGENS_ERRO[msg] || msg || 'Ocorreu um erro. Tente novamente.';
}

/* ---------------------------------------------------------
   Dialogs (login/cadastro e perfil)
   --------------------------------------------------------- */
function abrirDialogAuth(aba = 'entrar') {
  const dialog = document.getElementById('dialogAuth');
  if (!dialog) return;
  trocarAba(aba);
  document.getElementById('erroLogin').textContent = '';
  document.getElementById('erroCadastro').textContent = '';
  if (typeof dialog.showModal === 'function') dialog.showModal();
}
function trocarAba(aba) {
  const ehEntrar = aba === 'entrar';
  document.getElementById('abaEntrar').classList.toggle('is-ativa', ehEntrar);
  document.getElementById('abaEntrar').setAttribute('aria-selected', String(ehEntrar));
  document.getElementById('abaCadastro').classList.toggle('is-ativa', !ehEntrar);
  document.getElementById('abaCadastro').setAttribute('aria-selected', String(!ehEntrar));
  document.getElementById('painelEntrar').hidden = !ehEntrar;
  document.getElementById('painelCadastro').hidden = ehEntrar;
}

function iniciaisDoNome(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || '?';
}

/* ---------------------------------------------------------
   Atualização da UI conforme o estado de login
   --------------------------------------------------------- */
function atualizarUIAuth() {
  const btnEntrar = document.getElementById('btnEntrar');
  const avatarWrap = document.getElementById('avatarMenuWrap');
  const avatarIniciais = document.getElementById('avatarIniciais');
  const avatarNome = document.getElementById('avatarDropdownNome');
  const ehAdmin = perfilAtual?.role === 'admin';

  if (usuarioAtual) {
    if (btnEntrar) btnEntrar.hidden = true;
    if (avatarWrap) avatarWrap.hidden = false;
    if (avatarIniciais) avatarIniciais.textContent = iniciaisDoNome(perfilAtual?.nome || usuarioAtual.email);
    if (avatarNome) avatarNome.textContent = perfilAtual?.nome || usuarioAtual.email;
  } else {
    if (btnEntrar) btnEntrar.hidden = false;
    if (avatarWrap) avatarWrap.hidden = true;
  }
  document.getElementById('linkAdmin')?.toggleAttribute('hidden', !ehAdmin);
  document.getElementById('linkAdminMobile')?.toggleAttribute('hidden', !ehAdmin);
  // app.js reage a isso para recarregar favoritos e re-renderizar
  window.dispatchEvent(new CustomEvent('gloria:auth-mudou'));
}

async function carregarPerfil(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) { console.error('Erro ao carregar perfil:', error); return null; }
  return data;
}

/* ---------------------------------------------------------
   Login / Cadastro / Logout
   --------------------------------------------------------- */
function initFormLogin() {
  const form = document.getElementById('painelEntrar');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const erroEl = document.getElementById('erroLogin');
    const btn = form.querySelector('.btn-primario');
    erroEl.textContent = '';
    btn.disabled = true; btn.textContent = 'Entrando…';
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
    btn.disabled = false; btn.textContent = 'Entrar';
    if (error) { erroEl.textContent = traduzirErro(error.message); return; }
    document.getElementById('dialogAuth')?.close();
    form.reset();
  });

  document.getElementById('btnEsqueciSenha')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const erroEl = document.getElementById('erroLogin');
    if (!email) { erroEl.textContent = 'Digite seu e-mail acima primeiro.'; return; }
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
    erroEl.style.color = 'var(--color-success)';
    erroEl.textContent = error ? traduzirErro(error.message) : 'Enviamos um link de redefinição para o seu e-mail.';
  });
}

function initFormCadastro() {
  const form = document.getElementById('painelCadastro');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('cadastroNome').value.trim();
    const email = document.getElementById('cadastroEmail').value.trim();
    const senha = document.getElementById('cadastroSenha').value;
    const erroEl = document.getElementById('erroCadastro');
    const btn = form.querySelector('.btn-primario');
    erroEl.textContent = '';
    btn.disabled = true; btn.textContent = 'Criando conta…';
    const { error } = await supabaseClient.auth.signUp({
      email, password: senha,
      options: { data: { nome } },
    });
    btn.disabled = false; btn.textContent = 'Criar conta';
    if (error) { erroEl.textContent = traduzirErro(error.message); return; }
    erroEl.style.color = 'var(--color-success)';
    erroEl.textContent = 'Conta criada! Se a confirmação por e-mail estiver ativa no projeto, verifique sua caixa de entrada antes de entrar.';
    form.reset();
  });
}


async function fazerLogout() {
  await supabaseClient.auth.signOut();
  document.getElementById('dialogPerfil')?.close();
}

/* ---------------------------------------------------------
   Perfil
   --------------------------------------------------------- */
function atualizarPreviewFoto(url, nome) {
  const img = document.getElementById('perfilFotoPreview');
  const placeholder = document.getElementById('perfilFotoPlaceholder');
  const seguro = urlSegura(url); // só http(s); bloqueia javascript:, data: etc.
  if (seguro) {
    img.src = seguro; img.alt = 'Sua foto de perfil'; img.hidden = false;
    placeholder.hidden = true;
  } else {
    img.hidden = true;
    placeholder.hidden = false;
    placeholder.textContent = iniciaisDoNome(nome);
  }
}

async function abrirDialogPerfil() {
  const dialog = document.getElementById('dialogPerfil');
  if (!dialog || !usuarioAtual) return;

  document.getElementById('perfilNome').value = perfilAtual?.nome || '';
  document.getElementById('perfilFoto').value = perfilAtual?.foto_url || '';
  document.getElementById('perfilTelefone').value = perfilAtual?.telefone || '';
  document.getElementById('perfilEmail').textContent = usuarioAtual.email || '';
  document.getElementById('perfilCriadoEm').textContent = perfilAtual?.criado_em
    ? new Date(perfilAtual.criado_em).toLocaleDateString('pt-BR')
    : '—';
  document.getElementById('erroPerfil').textContent = '';
  document.getElementById('sucessoPerfil').textContent = '';
  document.getElementById('erroFoto').textContent = '';
  atualizarPreviewFoto(perfilAtual?.foto_url, perfilAtual?.nome);

  const [{ count: totalFavoritos }, { count: totalAvaliacoes }] = await Promise.all([
    supabaseClient.from('favoritos').select('*', { count: 'exact', head: true }).eq('usuario_id', usuarioAtual.id),
    supabaseClient.from('avaliacoes').select('*', { count: 'exact', head: true }).eq('usuario_id', usuarioAtual.id),
  ]);
  document.getElementById('statFavoritos').textContent = totalFavoritos ?? 0;
  document.getElementById('statAvaliacoes').textContent = totalAvaliacoes ?? 0;

  if (typeof dialog.showModal === 'function') dialog.showModal();
}

function initUploadFoto() {
  document.getElementById('perfilFotoArquivo')?.addEventListener('change', async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !usuarioAtual) return;
    const erroEl = document.getElementById('erroFoto');
    erroEl.textContent = '';

    if (arquivo.size > 2 * 1024 * 1024) {
      erroEl.textContent = 'Escolha uma imagem de até 2 MB.';
      e.target.value = '';
      return;
    }

    const extensao = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[arquivo.type];
    if (!extensao) {
      erroEl.textContent = 'Use uma imagem JPG, PNG ou WebP.';
      e.target.value = '';
      return;
    }
    const caminho = `${usuarioAtual.id}/foto.${extensao}`;

    const { error: erroUpload } = await supabaseClient.storage
      .from('avatars')
      .upload(caminho, arquivo, { upsert: true, cacheControl: '3600' });

    if (erroUpload) {
      erroEl.textContent = 'Não foi possível enviar a foto. Tente novamente.';
      console.error('Erro no upload da foto:', erroUpload);
      return;
    }

    const { data } = supabaseClient.storage.from('avatars').getPublicUrl(caminho);
    // "cache-bust" com timestamp, senão o navegador mostra a foto antiga em cache
    const urlComVersao = `${data.publicUrl}?v=${Date.now()}`;
    document.getElementById('perfilFoto').value = urlComVersao;
    atualizarPreviewFoto(urlComVersao, perfilAtual?.nome);
  });
}

function initFormPerfil() {
  const form = document.getElementById('formPerfil');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!usuarioAtual) return;
    const nome = document.getElementById('perfilNome').value.trim();
    const foto_url = document.getElementById('perfilFoto').value.trim() || null;
    const telefone = document.getElementById('perfilTelefone').value.trim() || null;
    const erroEl = document.getElementById('erroPerfil');
    const sucessoEl = document.getElementById('sucessoPerfil');
    erroEl.textContent = ''; sucessoEl.textContent = '';
    if (foto_url && !/^https:\/\//i.test(foto_url)) {
      erroEl.textContent = 'Use um link que comece com https:// para a foto.';
      return;
    }

    const { error } = await supabaseClient
      .from('profiles')
      .update({ nome, foto_url, telefone })
      .eq('id', usuarioAtual.id);

    if (error) { erroEl.textContent = traduzirErro(error.message); return; }
    perfilAtual = { ...perfilAtual, nome, foto_url, telefone };
    sucessoEl.textContent = 'Perfil atualizado.';
    atualizarUIAuth();
  });

  document.getElementById('btnSair')?.addEventListener('click', fazerLogout);
}

function initAvatarDropdown() {
  const btn = document.getElementById('btnAvatar');
  const dropdown = document.getElementById('avatarDropdown');
  if (!btn || !dropdown) return;

  const fechar = () => { dropdown.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const abrir = () => { dropdown.hidden = false; btn.setAttribute('aria-expanded', 'true'); };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.hidden ? abrir() : fechar();
  });
  document.addEventListener('click', (e) => {
    if (!dropdown.hidden && !e.target.closest('#avatarMenuWrap')) fechar();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });

  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('[data-acao]');
    if (!item) return;
    fechar();
    switch (item.dataset.acao) {
      case 'perfil': abrirDialogPerfil(); break;
      case 'favoritos': if (typeof abrirFavoritosDoMenu === 'function') abrirFavoritosDoMenu(); break;
      case 'historico': if (typeof abrirDialogHistorico === 'function') abrirDialogHistorico(); break;
      case 'avaliacoes': if (typeof abrirDialogMinhasAvaliacoes === 'function') abrirDialogMinhasAvaliacoes(); break;
      case 'sair': fazerLogout(); break;
    }
  });
}

/* ---------------------------------------------------------
   Wiring geral
   --------------------------------------------------------- */
function initAuthUI() {
  document.getElementById('btnEntrar')?.addEventListener('click', () => abrirDialogAuth('entrar'));
  initAvatarDropdown();
  document.getElementById('abaEntrar')?.addEventListener('click', () => trocarAba('entrar'));
  document.getElementById('abaCadastro')?.addEventListener('click', () => trocarAba('cadastro'));
  document.getElementById('btnAbrirHistorico')?.addEventListener('click', () => {
    document.getElementById('dialogPerfil')?.close();
    if (typeof abrirDialogHistorico === 'function') abrirDialogHistorico();
  });
  initFormLogin();
  initFormCadastro();
  initFormPerfil();
  initUploadFoto();
}

async function initAuth() {
  if (typeof supabaseClient === 'undefined') {
    console.error('Supabase não carregou — verifique a conexão ou o script supabase-config.js.');
    return;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  usuarioAtual = session?.user || null;
  if (usuarioAtual) perfilAtual = await carregarPerfil(usuarioAtual.id);
  atualizarUIAuth();

  supabaseClient.auth.onAuthStateChange(async (_evento, session) => {
    usuarioAtual = session?.user || null;
    perfilAtual = usuarioAtual ? await carregarPerfil(usuarioAtual.id) : null;
    atualizarUIAuth();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  try { initAuthUI(); } catch (err) { console.error('Falha ao iniciar UI de autenticação:', err); }
  initAuth().catch(err => console.error('Falha ao iniciar autenticação:', err));
});
