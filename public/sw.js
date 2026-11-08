/* =========================================================
   Glória em Movimento — Service Worker
   Estratégias:
   - HTML/CSS/JS do próprio site: network-first (tenta a rede
     primeiro; só usa o cache se a rede falhar/estiver offline).
     Isso evita servir uma versão antiga presa em cache depois de
     um novo deploy — o preço é 1 requisição de rede a mais por
     arquivo, aceitável para o tamanho deste site.
   - Ícones (mudam raramente): cache-first.
   - Tiles do mapa (OpenStreetMap): stale-while-revalidate, limitado
     em quantidade.
   - Navegação: network-first com fallback para cache/offline.html
   ========================================================= */

const VERSAO_CACHE = 'gloria-v2.0.1';
const CACHE_ESTATICO = `${VERSAO_CACHE}-estatico`;
const CACHE_TILES = `${VERSAO_CACHE}-tiles`;
const LIMITE_TILES = 120;

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/styles.css?v=6',
  '/css/tema-v2.css?v=6',
  '/js/app.js?v=6',
  '/js/auth.js?v=6',
  '/js/sugestao.js?v=6',
  '/js/supabase-config.js?v=6',
  '/js/ai-assistente.js?v=6',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon.png',
  '/img/logo-icon.png',
  '/img/logo-full.png',
];

const EXTENSOES_ICONE = ['.png', '.ico', '.svg', '.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ESTATICO)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((chave) => chave.startsWith('gloria-') && !chave.startsWith(VERSAO_CACHE))
          .map((chave) => caches.delete(chave))
      )
    ).then(() => self.clients.claim())
  );
});

async function limitarTamanhoCache(nomeCache, limite) {
  const cache = await caches.open(nomeCache);
  const chaves = await cache.keys();
  if (chaves.length > limite) {
    await cache.delete(chaves[0]);
    await limitarTamanhoCache(nomeCache, limite);
  }
}

function ehTileDeMapa(url) {
  return /tile\.openstreetmap\.org/.test(url) || /unpkg\.com\/leaflet/.test(url) || /arcgisonline\.com/.test(url) || /basemaps\.cartocdn\.com/.test(url);
}
function ehIcone(url) {
  return EXTENSOES_ICONE.some((ext) => url.pathname.endsWith(ext));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navegação (HTML): network-first, cai para cache e depois offline.html
  if (request.mode === 'navigate') {
    // O painel admin nunca fica guardado no cache (dados sensíveis e login).
    if (url.pathname.startsWith('/admin')) return;
    event.respondWith(
      fetch(request)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_ESTATICO).then((cache) => cache.put(request, copia));
          }
          return resposta;
        })
        .catch(() =>
          caches.match(request).then((res) => res || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Tiles de mapa e libs de terceiros: stale-while-revalidate, com limite
  if (ehTileDeMapa(url.href)) {
    event.respondWith(
      caches.open(CACHE_TILES).then(async (cache) => {
        const respostaCache = await cache.match(request);
        const buscaRede = fetch(request)
          .then((resposta) => {
            cache.put(request, resposta.clone());
            limitarTamanhoCache(CACHE_TILES, LIMITE_TILES);
            return resposta;
          })
          .catch(() => respostaCache);
        return respostaCache || buscaRede;
      })
    );
    return;
  }

  // Ícones do próprio site: cache-first (mudam raramente, não custa nada
  // guardar por mais tempo).
  if (url.origin === self.location.origin && ehIcone(url)) {
    event.respondWith(
      caches.match(request).then((respostaCache) => respostaCache || fetch(request).then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE_ESTATICO).then((cache) => cache.put(request, copia));
        }
        return resposta;
      }))
    );
    return;
  }

  // Demais arquivos do próprio site (CSS/JS/manifest): network-first —
  // sempre tenta buscar a versão mais nova; só usa o cache se a rede
  // falhar (offline ou instável).
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_ESTATICO).then((cache) => cache.put(request, copia));
          }
          return resposta;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Qualquer outra origem (ex.: fontes do Google): cache-first simples
  event.respondWith(
    caches.match(request).then((respostaCache) => respostaCache || fetch(request))
  );
});
