// Service worker do Painel Admin - Loja do Helcinho
//
// Regras (pensadas para NUNCA servir um painel velho):
//  - Dados do Supabase (pedidos, produtos, login...) NUNCA passam pelo cache: sempre vão direto à nuvem.
//  - Arquivos do painel: "rede primeiro" (sempre busca a versão nova; só usa o cache se estiver sem internet).
//  - Bibliotecas externas (Tailwind, ícones, gráficos): usa o cache e atualiza em segundo plano.
//  - O site da loja (index.html) não é tocado por este service worker.
//
// Ao publicar uma versão nova do painel, basta trocar o número abaixo.
const VERSAO = 'helcinho-admin-v5';

const ARQUIVOS_DO_PAINEL = [
  'admin.html',
  'admin.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'logohelcinho.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    // Um arquivo ausente não pode impedir a instalação
    await Promise.allSettled(ARQUIVOS_DO_PAINEL.map((a) => cache.add(new Request(a, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

function ehArquivoDoPainel(url) {
  const nome = url.pathname.split('/').pop();
  return ARQUIVOS_DO_PAINEL.includes(nome);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 1) Supabase: nunca cachear
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;

  // 2) Arquivos do painel (mesmo domínio): rede primeiro
  if (url.origin === self.location.origin) {
    if (!ehArquivoDoPainel(url)) return; // index.html e o resto: comportamento normal do navegador
    event.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      try {
        // "no-cache" força o navegador a conferir com o servidor (o GitHub Pages guarda arquivos por ~10 min)
        const resposta = await fetch(req, { cache: 'no-cache' });
        if (resposta && resposta.ok) cache.put(req, resposta.clone());
        return resposta;
      } catch (erro) {
        const guardado = await cache.match(req, { ignoreSearch: true });
        if (guardado) return guardado;
        if (req.mode === 'navigate') {
          const painel = await cache.match('admin.html');
          if (painel) return painel;
        }
        throw erro;
      }
    })());
    return;
  }

  // 3) Bibliotecas externas (CDN): cache + atualização em segundo plano
  event.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const guardado = await cache.match(req);
    const buscando = fetch(req)
      .then((resposta) => {
        if (resposta && (resposta.ok || resposta.type === 'opaque')) cache.put(req, resposta.clone());
        return resposta;
      })
      .catch(() => guardado);
    return guardado || buscando;
  })());
});
