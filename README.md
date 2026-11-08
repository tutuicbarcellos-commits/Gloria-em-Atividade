# Glória em Movimento

Guia digital do bairro **Glória**, zona sul de **Porto Alegre (RS)**: comércios e serviços, mapa, busca, avaliações dos usuários e uma assistente em linguagem natural (**Glória IA**).

Site estático (HTML, CSS e JavaScript puros, sem build) publicado na **Vercel**, com dados e contas no **Supabase** e a Glória IA em uma **função serverless** (`api/gloria-ia.js`) que usa a API do Gemini.

---

## Como o projeto está organizado

```
gloria/
├── public/                     ← única pasta publicada no ar
│   ├── index.html
│   ├── offline.html, 404.html, manifest.json, sw.js
│   ├── robots.txt, sitemap.xml, _headers
│   ├── css/styles.css
│   ├── css/tema-v2.css         # camada visual atual (sobrescreve styles.css)
│   ├── js/
│   │   ├── app.js              # interface, mapa, busca, favoritos, avaliações, histórico, admin
│   │   ├── auth.js             # login, cadastro, sessão, perfil e foto
│   │   ├── supabase-config.js  # URL e chave pública do Supabase
│   │   ├── ai-assistente.js    # interface da Glória IA
│   │   ├── admin.js            # painel administrativo (/admin/)
│   │   └── sugestao.js         # formulário público "Sugerir comércio"
│   ├── admin/index.html        # página do painel administrativo
│   ├── img/  e  icons/
├── api/
│   └── gloria-ia.js            # rota /api/gloria-ia (Vercel); chama a lógica abaixo
├── netlify/functions/
│   └── gloria-ia.js            # lógica da Glória IA (chave do Gemini fica só no servidor)
├── supabase/
│   ├── schema.sql              # instalação completa do banco (tabelas, regras de acesso, dados)
│   ├── storage-e-admin.sql     # bucket de fotos e instruções para administradores
│   ├── migracao-seguranca.sql  # atualização para bancos que já existiam
│   ├── migracao-website.sql    # atualização antiga (coluna website)
│   ├── migracao-perimetro-oficial.sql
│   ├── migracao-solicitacoes.sql # tabela de sugestões + aprovar/recusar
│   └── testes/verificar-seguranca.sql
├── vercel.json                 # publica apenas public/, headers de segurança e função da IA
└── README.md
```

Tudo fora de `public/` não é servido pelo site. Acessar `/README.md` ou `/supabase/...` retorna 404. A exceção é `/api/gloria-ia`, que é a função da IA.

---

## Configuração

### 1. Banco de dados (Supabase)

- **Instalação nova:** no SQL Editor, rode `supabase/schema.sql` e depois `supabase/storage-e-admin.sql`.
- **Banco que já existia:** rode `supabase/migracao-seguranca.sql`.
- **Verificação:** rode `supabase/testes/verificar-seguranca.sql`. Se aparecer `OK`, as checagens passaram.

**Configuração no painel do Supabase:** por padrão, o Supabase exige confirmação de e-mail antes do primeiro login. Em **Authentication → Sign In / Providers → Email** você pode desativar essa exigência para testes, ou configurar o envio de e-mails para produção.

**Administradores:** o papel `admin` é definido diretamente no banco, pelo SQL Editor (veja as instruções em `supabase/storage-e-admin.sql`). Não existe tela no site para promover usuários. Senhas nunca ficam no código: o admin entra com a própria conta em `/admin/`.

**Sugestões de comércios:** qualquer pessoa envia pelo botão "Sugerir comércio". A sugestão fica pendente em `solicitacoes_estabelecimento` e só vira comércio no mapa quando um admin aprova em `/admin/`, informando as coordenadas. Recusar não apaga o registro. Há proteção básica contra robôs (campo armadilha e teto de 30 envios por hora, no banco).

### 2. Variáveis de ambiente (Vercel → Project → Settings → Environment Variables)

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `GEMINI_API_KEY` | Sim (para a IA) | Chave do Google AI Studio (grátis em aistudio.google.com/apikey). Sem ela, a Glória IA mostra uma mensagem de indisponibilidade; o resto do site funciona. |
| `GLORIA_IA_MODEL` | Não | Modelo do Gemini. Padrão: `gemini-flash-latest`. |
| `RATE_LIMIT_SALT` | Recomendada | Texto aleatório e longo, usado para anonimizar IPs no contador de uso. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Não | Já têm valor padrão com o mesmo projeto público. Só mude se trocar de projeto. |

Depois de alterar variáveis, faça um novo deploy (Deployments → Redeploy) para elas valerem.

**Publicação na Vercel:** o `vercel.json` na raiz define que a pasta publicada é `public/`. Se a Vercel mostrar 404 em `/`, confirme em Project → Settings → Build & Development que o projeto é o repositório inteiro (sem "Root Directory" apontando para outra pasta) e que o `vercel.json` foi commitado. O arquivo `_headers` e a pasta `netlify/` são da versão Netlify e não são usados pela Vercel (a lógica da IA é lida de lá pela ponte em `api/`).

---

## O que o site faz

- Busca instantânea, filtro por categoria e ordenação por proximidade ou avaliação.
- Cards com foto (ou ilustração da categoria), distância e status "Aberto agora" calculado a partir do horário.
- Mapa com Leaflet e OpenStreetMap, marcadores por categoria e geolocalização (com fallback se for negada).
- Página de detalhes, favoritos, histórico de buscas e avaliações (uma por usuário e por comércio, editável).
- Login por e-mail e senha, recuperação de senha, perfil com foto.
- Painel administrativo em `/admin/` (página própria, sem indexação): fila de sugestões, aprovação com coordenadas, edição e ocultação de comércios.
- PWA com funcionamento offline básico, tema claro e escuro, página 404 própria.

### Quais dados são públicos

- Os dados dos comércios são públicos, mas só os que estão ativos.
- Nome e foto de perfil são públicos. **Telefone e papel (role) são privados**: cada usuário vê apenas o próprio perfil completo.
- Avaliações (nota e comentário) são públicas.

### Limitações conhecidas

- Os dados de nome, endereço, telefone e horário são um retrato do momento da pesquisa. Nada os atualiza sozinho se o comércio mudar.
- A nota do Google é uma referência importada; a média das avaliações feitas no próprio site é mostrada separadamente.
- Hoje cada comércio tem uma foto (`foto_url`). Muitos comércios ainda não têm foto.
- A Glória IA não filtra por preço (esse dado não existe) e não conhece eventos ou promoções. Ela só interpreta o pedido; quem busca e mostra os comércios é o próprio site, com os dados do banco.

---

## Glória IA

Quando a pessoa faz uma pergunta, o texto vai para a rota `/api/gloria-ia` (`api/gloria-ia.js`, lógica em `netlify/functions/gloria-ia.js`), que pede ao modelo a intenção da pergunta (categoria, se quer só os abertos, se precisa de localização). Quem monta a lista de resultados é o site, com os dados reais do banco. **A IA não vê nem inventa dados de comércios.**

**Segurança, em termos gerais:**
- A chave do Gemini fica só no servidor.
- A função só responde a pedidos vindos dos domínios do próprio site. Isso **não é autenticação**: o cabeçalho de origem é enviado pelo navegador e pode ser falsificado por qualquer cliente. Por isso não confiamos nele sozinho.
- O uso é limitado por IP, com um contador compartilhado entre todas as instâncias da função. Se o contador estiver indisponível, a função recusa o pedido em vez de gastar a cota sem controle.
- O conteúdo enviado pelas pessoas é tratado como dado, nunca como instrução.
- Além disso, é preciso definir um **teto de quota** no Google AI Studio, como segunda linha de defesa contra custo inesperado.

---

## Como reportar vulnerabilidades

Se você encontrou um problema de segurança neste site, por favor não abra uma issue pública. Envie os detalhes para: **[INSIRA-CONTATO]**.

Inclua a descrição do problema, os passos para reproduzir e o impacto que você imagina. Respondemos o mais rápido possível e agradecemos a quem avisa com responsabilidade.

---

## Antes de publicar (checklist)

- [ ] Rodar `supabase/migracao-seguranca.sql` no banco de produção e depois `supabase/testes/verificar-seguranca.sql`.
- [ ] Rodar `supabase/migracao-solicitacoes.sql` e promover a conta de admin (veja `supabase/storage-e-admin.sql`).
- [ ] Definir `GEMINI_API_KEY` e `RATE_LIMIT_SALT` na Vercel.
- [ ] Configurar o teto de quota do Gemini no Google AI Studio.
- [ ] Fixar a versão do `@supabase/supabase-js` e gerar o hash SRI (veja o comentário `TODO-SRI` em `public/index.html`).
- [ ] Preencher o contato de segurança nesta página.
- [ ] Revisar as configurações de e-mail no Supabase.
- [ ] Trocar o domínio de exemplo, se ainda houver, nas meta tags e no sitemap.
- [ ] Rodar uma auditoria [Lighthouse](https://developer.chrome.com/docs/lighthouse) no domínio final.

### Próximos passos (fora do escopo atual)

- Páginas separadas por comércio, para SEO (exigiria migrar para um framework com renderização no servidor).
- Exclusão de comércios pelo painel (hoje o admin só ativa ou desativa, de propósito).
- Galeria com várias fotos por comércio.
