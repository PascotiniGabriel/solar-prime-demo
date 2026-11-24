# Solar Prime CRM (demonstração)

CRM estático para uma empresa de energia solar. HTML + CSS + JS puro, sem build, sem frameworks, sem CDN. Dados fictícios salvos no `localStorage` (chave `solarprime_v1`).

## Como rodar
- Abra `index.html` direto no navegador (funciona via `file://`), ou
- publique a pasta no GitHub Pages (Settings > Pages > branch `main`, pasta `/root`).

O link "Resetar dados" no topo restaura o seed original. O seletor "Ver como" alterna Dono, Vendedor, Técnico, Financeiro e Gestora de tráfego (`trafego`: vê Início, Leads, Funil, Marketing e Importar; vendedor vê só os próprios leads). `Ctrl+K` abre a busca global.

## Módulos
Início, Leads, Funil (etapas personalizáveis; arrastar para rolar), Conversas, Propostas, Contratos, Agenda, Obras, Estoque, Financeiro, Metas, Marketing & Tráfego (ROAS, CPL, CAC por anúncio), Importar dados (planilhas CSV/Excel) e Configurações. Há também a página comercial em `apresentacao/index.html`. Etapas ativas (inclusive personalizadas): `SP.consts.etapasAtivas()`.

## Publicar no GitHub Pages
1. Crie um repositório e envie todo o conteúdo da pasta (inclui `index.html` e `apresentacao/`).
2. Em Settings > Pages, escolha "Deploy from a branch", branch `main`, pasta `/ (root)`.
3. Acesse `https://<usuario>.github.io/<repositorio>/` (apresentação em `/apresentacao/`). Os caminhos são relativos, não precisa de build.

## Estrutura
```
index.html           shell + lista de scripts/estilos
css/app.css          estilos base (tema claro/escuro)
css/modules/<m>.css  estilos opcionais de cada módulo (já linkados)
js/data.js           seed (SP.consts, SP.buildSeed)
js/store.js          SP.store, SP.session
js/ui.js             SP.ui
js/app.js            SP.register, roteador, menu, busca, notificações
js/modules/<m>.js    um arquivo por módulo
```

## Guia para módulos
**Convenção:** cada módulo edita apenas `js/modules/<nome>.js` e, se precisar, `css/modules/<nome>.css` (prefixe as classes com o nome do módulo, ex. `.leads-...`). Não altere `app.css`, `ui.js`, `store.js`, `data.js` nem `index.html` (peça ao responsável pela fundação). Todo texto de UI em PT-BR. Sempre escape texto de dados com `SP.ui.esc()` ao montar HTML.

### SP.register
```js
SP.register({
  route: 'leads',          // #/leads ; #/leads/<id> => params.id
  title: 'Leads', icon: 'users',            // nome de ícone de SP.ui.icon
  group: 'Vendas',         // '' (topo) | 'Vendas' | 'Operação' | 'Gestão'
  order: 10,               // ordenação no menu
  roles: ['dono','vendedor'],               // dono|vendedor|tecnico|financeiro|trafego
  render(el, params) {}    // params = {id, segs, query}
});
```
Outras globais: `SP.go('leads/l5')` navega; `SP.refresh()` re-renderiza a rota atual; `SP.session.role / userId / user()`.
Detalhe de lead: a busca global e os alertas linkam para `#/leads/<leadId>`; conversas para `#/conversas/<conversaId>`. O módulo `leads` deve tratar `params.id`.

### SP.store
`get()` banco inteiro · `collection(nome)` array vivo · `find(nome,id)` · `where(nome,fn)` · `upsert(nome,item)` (gera id se faltar) · `patch(nome,id,parcial)` · `remove(nome,id)` · `update(fn(db))` · `save()` (após mutar direto) · `log(acao,entidade,id,detalhe)` auditoria · `on(fn)` ouve mudanças (retorna cancelar) · `reset()` · `user(id)` · `lead(id)` · `visibleLeads()` (respeita o papel) · `vendedores()`.

Formatos (todas as datas em ISO string):
- **usuarios** `{id, nome, papel, email, cor}` (u1 dono, u2-u6 vendedores, u7 técnico, u8 financeiro)
- **leads** `{id, nome, telefone, cpfCnpj, cidade, endereco, tipo, concessionaria, consumoKwh, valorConta, tipoTelhado, areaM2, tipoLigacao, origem, campanha, vendedorId, etapa, motivoPerda, score, criadoEm, ultimoContato, valorEstimado, duplicadoDe, objecoes[], interacoes[{em,tipo,texto,porId}], primeiraRespostaMin}`
- **conversas** `{id, leadId, canal:'whatsapp'|'instagram', naoLidas, atualizadoEm, mensagens[{id,de:'cliente'|'vendedor',texto,em}]}`
- **propostas** `{id, numero, leadId, vendedorId, potenciaKwp, modulos, moduloModelo, inversor, valor, geracaoMensalKwh, economiaMensal, paybackAnos, formaPagamento, status:'rascunho|enviada|visualizada|aceita|recusada', criadaEm, enviadaEm, validadeEm}`
- **contratos** `{id, numero, leadId, propostaId, vendedorId, valor, formaPagamento, status:'aguardando_assinatura|assinado', criadoEm, assinadoEm}`
- **tarefas** `{id, leadId, tipo, titulo, responsavelId, vencimento, concluida}`
- **obras** `{id, leadId, contratoId, propostaId, tecnicoId, cidade, potenciaKwp, modulos, status:'andamento|concluida', etapas[{id,status:'concluida|andamento|pendente',previstaEm,concluidaEm}], inicioEm, previsaoEntrega, observacoes}`
- **estoque** `{id, categoria, nome, marca, sku, unidade, qtd, min, custo, preco, reservado, reservas[{obraId,qtd}]}` (disponível = qtd - reservado)
- **lancamentos** `{id, tipo:'receber|pagar', descricao, valor, vencimento, pagoEm, status:'pago|pendente|atrasado', categoria, contratoId?, leadId?, usuarioId?}`
- **campanhas** `{id, nome, canal, investimento, status, inicioEm}` (o `lead.campanha` usa o `nome`)
- **metas** `{id, vendedorId, mes:'AAAA-MM', metaVendas, metaLeads, metaConversao}`
- **auditoria** `{id, usuarioId, acao, entidade, entidadeId, detalhe, em}` · **empresa** `{nome, cnpj, cidade, telefone, email}`

Constantes em `SP.consts`: `ETAPAS` (id, nome, cor), `etapa(id)`, `OBRA_ETAPAS`, `FECHADAS`, `EM_NEGOCIACAO`, `ORIGENS`, `PAPEIS`, `MOTIVOS_PERDA`.

### SP.ui
`icon(nome,tamanho)` · `fmtMoney(v,{compact,cents})` · `fmtNum` · `fmtPct` · `fmtDate` · `fmtDateTime` · `fmtDuration(min)` · `timeAgo(iso)` · `daysSince(iso)` · `esc(txt)` · `toast(msg,'success|error')` · `modal({title,body,actions:[{label,cls,onClick(ctx),keepOpen}],size:'sm|lg'})` e `drawer(...)` (retornam `{el,body,close}`) · `badge(txt,variante)` · `badgeEtapa(id)` · `avatar(nome,{size})` · `userAvatar(userId)` · `empty({icon,title,text,actionHtml})` · `pageHeader(titulo,sub,acoesHtml)` · `kpi({label,value,sub,icon,tone,href})` · `progress(pct)` · `barChart(items,{format})` · `donut(items,{center})` · `tabs(items,ativo)` (botões `[data-tab]`) · `kanban(el,{columns,items,getCol,card,onMove,onClick})`.
Ícones: `SP.ui.iconNames()` lista todos (home, users, funnel, chat, file, contract, calendar, tool, box, wallet, target, megaphone, settings, search, bell, phone, mail, pin, alert, clock, trending, bolt, dollar, eye, edit, trash, send, filter, star, whatsapp, instagram, hardhat...). Para novo ícone, peça ao responsável pela fundação (mapa `ICONS` em `ui.js`).

### Classes CSS
`.card` `.card-title` `.grid .grid-2/3/4` `.row` `.stack` `.btn .btn-primary .btn-ghost .btn-danger .btn-sm .btn-icon` `.badge .badge-{gray|orange|green|red|blue|amber|purple}` `.chip` `.avatar` `.tabs .tab` `.table` (+ `.table-wrap`) `.form` (grid 2 colunas, `.full`) `.kpi-grid .kpi` `.bars` `.donut` `.list .list-row` `.progress` `.timeline` (`li.done|.pending`) `.kanban .kanban-col .kanban-card` `.empty` `.page-head` `.muted .text-sm .mt .mb .right .grow`. Variáveis: `--primary --accent --text --muted --bg --card --border --radius`. Tema escuro via `[data-theme=dark]` (use sempre as variáveis, nunca cores fixas de fundo/texto).
