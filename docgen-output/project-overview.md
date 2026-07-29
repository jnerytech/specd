# Visão Geral do Projeto — specd

## Resumo do Projeto / Visão Geral

`specd` é uma CLI TypeScript de *spec-driven development* (SDD) cujo diferencial é a **detecção de drift por âncoras**: cada requisito de especificação declara onde, no código, ele é realizado — um par arquivo + símbolo — e o comando `specd verify` resolve cada âncora contra o working tree a cada execução. Quando uma âncora deixa de resolver (o arquivo sumiu, o símbolo mudou de nome, a assinatura desapareceu), o gate reprova com exit code 1. Essa mecânica transforma a spec de documentação opcional — que qualquer time deixa apodrecer — em artefato *load-bearing*: quebrar a âncora quebra o build.

O pacote é publicado no npm como `@jnerytech/specd` (`package.json` declara `"name": "@jnerytech/specd"`, atualmente na versão `0.0.2`), expõe o binário `specd` apontando para `dist/cli.js`, exige Node `>=20`, é inteiramente ESM (`"type": "module"`) e roda em TypeScript compilado por `tsc`. O repositório é público em `github.com/jnerytech/specd`, licenciado sob MIT, autor `jnerytech`. Existe um projeto homônimo não relacionado, `@specd/cli` (organização `specd-sdd/SpecD`) — sem afiliação; o único ponto de contato técnico é o nome do binário, que se sombreia se ambos estiverem instalados globalmente.

O produto é regido por nove princípios invioláveis (P1–P9, documentados em `CLAUDE.md`), dos quais dois são garantidos por teste automatizado de arquitetura e não apenas por convenção:

- **P1 — a CLI nunca chama LLM no caminho de decisão.** Nenhum módulo alcançável a partir de `verify()` pode importar cliente de LLM. Verificado por `test/architecture/no-llm-in-verify.test.ts`, que percorre o grafo de imports real a partir de `src/verify/index.ts` (utilitário `collectImportGraph` em `test/architecture/import-graph.ts`).
- **P2 — um único gate.** Só `specd verify` retorna 1 por reprovação de qualidade; qualquer outro comando falha apenas operacionalmente (exit 2).
- **P3 — o gate nunca acessa a rede.** `explore` e `sync` acessam rede; `verify` não. Verificado por `test/architecture/no-network-in-verify.test.ts`.
- **P4 — nunca adivinhar em conflito.** Âncora ambígua, conflito de merge de três vias em `sync`, estado inconsistente: tudo sai com erro e diagnóstico, nunca com auto-resolução.
- **P5 — botão de configuração só existe se dois clientes reais divergirem** (evita superfície de configuração especulativa).
- **P6 — memória é efêmera; verdade durável vai para spec ou ADR.**
- **P7 — âncora é necessária, nunca suficiente.** Uma âncora que resolve prova que existe código no caminho declarado, não que o código satisfaz o requisito — julgamento semântico fica fora do caminho de decisão por P1, hoje e sempre.
- **P8 — ausência de dado não é conformidade.** Toda capacidade que lê estado externo distingue três resultados (certo / errado / não verificável), e o terceiro nunca é verde. A mesma disciplina vale na escrita: resposta de sucesso de um sistema externo não é prova de que a escrita aconteceu — quem confirma é uma releitura.
- **P9 — operação que custa alguma coisa não acontece em silêncio.** `archive` reescreve as capabilities e deixa tudo fora do índice git; `anchor fix` reescreve a âncora e não commita; `sync` recusa fechar um item de board quando o sinal de morte do requisito não é claramente declarado — três instâncias independentes da mesma regra.

O contrato de exit code é o eixo que permite CI distinguir "a spec/código está errado" de "a ferramenta quebrou":

| Código | Significado |
| --- | --- |
| 0 | Sucesso |
| 1 | Gate reprovou (só `verify`) — a spec ou o código estão errados |
| 2 | Falha operacional — rede, I/O, configuração inválida |

`specd` ainda **não está publicado no registry npm** sob o nome público de instalação padrão; até a primeira publicação efetiva, o caminho de uso é clonar o repositório, `npm install && npm run build`, e rodar `node dist/cli.js <comando>`, ou `npm link` uma vez para que `specd` funcione como binário do PATH.

## Arquitetura

A arquitetura segue uma separação estrita entre **núcleo determinístico** (tudo que `verify` alcança) e **periferia que acessa rede ou LLM** (`explore`, `sync`, os agentes de desenvolvimento). Essa fronteira é a peça central do design e é imposta por testes de arquitetura, não apenas documentada.

O ciclo pretendido do produto é:

```
explore → propose → apply → archive
   ↑                            ↓
   └────────── specd verify ────┘
```

- **`explore`** reúne contexto de fontes configuradas (board, git, HTTP, MCP) num bundle auditável por change, grava um manifesto e falha operacionalmente (exit 2) se uma fonte marcada obrigatória não coletar.
- **`propose`** converteria o bundle em `delta.md` e tarefas — **não implementado nesta versão**.
- **`apply`** executaria uma tarefa por vez, com `verify` fechando o loop a cada passo — **não implementado nesta versão**.
- **`archive`** aplica o `delta.md` de uma change às capabilities e arquiva o diretório da change.
- **`verify`** é o gate que fecha o ciclo, permanecendo desacoplado de rede e de modelo em qualquer ponto do ciclo.

Hoje o produto entrega o subconjunto `init → explore → verify → status → archive`, mais `sync` (reconciliação manual com um board externo) e `hooks` (integração com o host de agente, hoje Claude Code). `propose` e `apply` estão fora do escopo implementado; nenhum comportamento deles deve ser presumido a partir do código atual.

### O gate (`specd verify`)

`src/verify/index.ts` define `LAYER_ORDER`, a ordem fixa e não configurável das seis camadas (`VERIFY_LEVELS`, de `src/config/schema.ts`): `provenance → schema → coverage → anchors → evidence → project`. Cada camada é implementada em `src/verify/layers/{provenance,schema,coverage,anchors,evidence,project}.ts` e mapeada em `IMPLEMENTED`. A função `verify()`:

1. Resolve a raiz do projeto via `requireProjectRoot` (`src/core/root.ts`) — a raiz é o diretório que contém `.specd/`, não o `cwd` nem o toplevel do git.
2. Recusa-se a rodar num diretório sem `.specd/specs/` (`requireSpecdProject`), saindo com `OperationalError` (exit 2) em vez de aprovar vazio — a instância concreta de P8 que motivou a regra "ausência de dado não é conformidade" (corrigida na Fatia 2).
3. Executa cada camada habilitada em `config.verify.levels`, parando na primeira que falhar (`status: "failed"`) ou que não conseguir rodar (`status: "blocked"`, tratado como falha operacional e reportado separadamente em `report.blocked`).
4. Devolve um `VerifyReport` com `ok`, `layers`, `violations`, `stoppedAt` opcional e `disabled` (camadas fora de `config.verify.levels`).

As cinco primeiras camadas rodam offline em milissegundos e não conhecem a stack do projeto; a camada `project` faz shell-out ao `validation_command` declarado em `.specd/config.toml` — para este próprio repositório, `npm run verify`. Isso é *dogfooding* literal: o `specd verify` deste repositório delega a si mesmo via a camada `project`.

O comando de CLI (`src/cli/index.ts`, comando `verifyCommand`) traduz o relatório em exit code: se `report.blocked !== undefined`, exit 2 (falha operacional); senão, `report.ok ? 0 : 1`.

### Resolução de âncoras — a "escada" de cinco passos

`src/anchors/resolve.ts` implementa `resolveAnchor()`, uma função pura, determinística e sem I/O de rede, que resolve uma âncora `{ file, symbol? }` contra o working tree em até cinco passos ordenados (`LADDER_STEPS`):

1. `FILE_MISSING` — o arquivo declarado não existe → `dangling`.
2. `FILE_ONLY` — âncora sem `symbol` é satisfeita pela mera existência do arquivo → `resolved`.
3. `GREP` — a estratégia associada à extensão do arquivo (`strategyFor`, `src/anchors/strategy.ts`; hoje só a estratégia `grep`, `src/anchors/strategies/grep.ts`) procura o símbolo no conteúdo do arquivo.
4. `TREESITTER` — passo reservado na escada, mas inatingível na v1: `strategyFor` lança erro de configuração antes de chegar aqui.
5. `REPO_SEARCH` — se o símbolo não foi achado onde a âncora aponta, procura-o no resto do repositório (`findSymbolInRepo`, `src/anchors/search.ts`), excluindo `.specd/`, `openspec/` e `docs/` (`SEARCH_EXCLUDE_PREFIXES`) para não confundir a própria declaração da spec com uma implementação real. Exatamente um match vira uma sugestão (`dangling-with-suggestion`); zero ou vários matches deixam a âncora `dangling` sem sugestão — nunca escolhendo entre candidatos ambíguos (P4).

Este resolvedor é reaproveitado tanto pela camada `anchors` do gate quanto por `archive` (que exige 100% de resolução de âncoras do escopo em voo antes de aplicar um delta, ignorando a política configurada) e por `anchor fix`.

### Configuração

`src/config/resolve.ts` (`resolveConfig()`) mescla quatro camadas em ordem crescente de precedência — **flag de CLI > arquivo do workspace (`.specd/config.toml`) > arquivo global (`~/.specd/config.toml`) > default embutido (`DEFAULT_CONFIG`)** — campo a campo, guiado pelo schema (`src/config/schema.ts`), de modo que uma seção definida numa fonte de maior precedência nunca apaga campos que uma fonte de menor precedência definiu. O parsing de TOML usa a dependência `smol-toml`; erros de sintaxe ou de schema levantam `ConfigError` (`src/config/errors.ts`). Credenciais de board nunca vivem em `config.toml` — `src/config/credentials.ts` resolve tokens a partir de variáveis de ambiente referenciadas por nome (`token_env`).

### Sincronização com board externo

`src/sync/index.ts` (`sync()`) reconcilia o estado da spec com um board de terceiros. O único adaptador medido é Redmine (`src/sync/adapters/redmine.ts`, via REST); a interface `BoardAdapter` (`src/sync/adapter.ts`) foi desenhada para múltiplos fornecedores mas qualquer afirmação sobre outro provedor (ex.: Azure DevOps) seria dedução, não fato medido neste código. A decisão de "o que mudou" vem de um **merge de três vias** sobre um `synced_hash` gravado no frontmatter da capability (`src/sync/hash.ts`, `src/sync/merge.ts`), nunca do timestamp do board. Itens com os dois lados alterados de formas diferentes terminam em `conflict` e nada é escrito (`assertNoConflicts`) — P4 aplicado à escrita externa.

`sync` nunca fecha um card de board por engano: `findOrphanedLinks()` classifica um link órfão em três sinais de morte — `declared` (identificador listado em `retired` no frontmatter da capability, escrito por `archive`), `proposed` (identificador sob `REMOVED` de uma change ainda aberta) e `none` (nada na spec diz que o requisito morreu). `classifyOrphans()` lê o corpo do card no board e só fecha (`close`) quando a morte é `declared` **e** nenhum item planejado sem link ainda tem o mesmo corpo (evitando fechar um card que na verdade foi renomeado); morte `proposed` é reportada como `retiring` sem nenhuma escrita; ausência de sinal é `refuse`, e a execução para com `UndeclaredOrphanError` antes de qualquer escrita (`assertNoUnsanctionedOrphans`). `sync` nunca roda a partir de um hook — imposto por `test/architecture/no-sync-in-hooks.test.ts` — porque hook roda sem ninguém olhando, e escrever em sistema de terceiro sem supervisão é exatamente o que P9 proíbe.

### Hooks

`src/hooks/{install,uninstall,run,protocol,settings}.ts` integra `specd` ao ciclo de eventos de um host de agente (hoje, Claude Code, via `.claude/settings.json`). `hooks install` escreve a configuração (ex.: rodar `specd verify --fast` no evento `Stop`); `hooks run <event>` é o adaptador invocado pelo host e traduz o contrato de exit code de `specd` para o protocolo do host — a única fronteira onde os dois contratos de código de saída se encontram, isolada deliberadamente (`test/architecture/hook-exit-codes.test.ts` garante que nenhum módulo sob `src/hooks/` importa a tabela `EXIT` de `specd` diretamente, forçando a tradução a acontecer no ponto único e visível).

## Stack Tecnológico

| Camada | Tecnologia |
| --- | --- |
| Linguagem | TypeScript (compilado por `tsc`, `typescript-eslint` no lint) |
| Runtime | Node.js `>=20`, módulo ESM (`"type": "module"`) |
| Parsing de config | `smol-toml` (TOML) |
| Parsing de frontmatter/spec | `yaml` (YAML embutido em Markdown) |
| Testes | `vitest` (`vitest run`) |
| Execução de scripts dev sem build | `tsx` |
| Lint | `eslint` + `@eslint/js` + `typescript-eslint` |
| Formatação | `prettier` |
| Build | `tsc -p tsconfig.json` → `dist/` |
| CI/gate local | `npm run verify` (format + lint + test + build, offline, sem Docker) |
| Teste de integração | `test/integration/redmine/run.sh` (sobe Redmine em container) |

Não há framework web, banco de dados ou runtime de UI: `specd` é uma CLI de arquivo único de entrada (`src/cli.ts`) que lê e escreve arquivos Markdown/TOML/JSON locais e, em dois comandos específicos (`explore`, `sync`), fala HTTP com sistemas externos (board, MCP).

## Funcionalidades / Capacidades Principais

Comandos expostos por `src/cli/index.ts` (`registerCommands()`), todos descritos no `USAGE` embutido no binário:

| Comando | Função | Particularidade de exit code |
| --- | --- | --- |
| `specd init [--force]` | Cria `.specd/` com um `config.toml` completo (`src/init/index.ts`, com detecção de stack em `src/init/detect-stack.ts`, ex.: `.NET`) | Sempre 0 |
| `specd verify [--fast] [--json]` | Roda o gate de seis camadas | **Único comando que retorna 1** (reprovação); 2 se uma camada travar |
| `specd status [--json]` | Relata drift e trabalho pendente, agrupado por change (`src/status/index.ts`) | Sempre 0 — informa, não julga |
| `specd explore <card> --change <name> [--json]` | Coleta as fontes configuradas (board, git, HTTP, MCP) num bundle auditável | 2 se fonte obrigatória falhar |
| `specd sync [--dry-run] [--json]` | Reconcilia spec ↔ board configurado | 2 em conflito ou órfã não declarada; nunca 1 |
| `specd archive <change> [--sync]` | Aplica o `delta.md` de uma change às capabilities e arquiva o diretório | 2 se a change não estiver pronta |
| `specd anchor suggest <capability>` \| `--file <path>` | Sugere onde ancorar requisitos de uma capability, ou lista o que um arquivo declara | Sempre 0 |
| `specd anchor fix <requirement>` | Reescreve uma âncora pendurada para a localização sugerida (sem commitar) | 2 se não houver o que aplicar |
| `specd hooks install / uninstall / run <event>` | Integra/gerencia hooks com o host de agente | `run` responde no contrato de exit code do host, não no de `specd` |
| `specd help` / `--help` / `--version` | Ajuda e versão | 0 |

Capacidades transversais dignas de nota:

- **Detecção de drift por âncoras** — o diferencial central, descrito acima.
- **Gramática EARS para requisitos** (`src/ears/parse.ts`, `src/ears/patterns.ts`) — cinco padrões validados por parser: Ubíquo (`The <sistema> SHALL <resposta>`), Evento (`WHEN ... SHALL ...`), Estado (`WHILE ... SHALL ...`), Indesejado (`IF ... THEN ... SHALL ...`) e Opcional (`WHERE ... SHALL ...`). Keywords são sintaxe fixa em inglês; a prosa do requisito pode ser em qualquer idioma (este repositório usa `pt-BR`, declarado em `[project] language` no `config.toml`). Um requisito só pode ter um `SHALL`.
- **Modelo B de escrita** — `.specd/specs/` contém só verdade realizada; requisito de comportamento ainda não existente vive no `delta.md` de uma change aberta até `specd archive` o aplicar. Escrever requisito novo direto em `specs/` recria o estado ilegal que uma change antiga (`migracao-modelo-b`) corrigiu.
- **Política de âncora graduada por origem** — pendurada em `specs/` é erro; pendurada em `delta.md` de change aberta é warning, refletindo que requisito em voo é maleável e congela só ao ser realizado.
- **Reconciliação segura com board externo**, incluindo o tratamento de renomeação vs. remoção de requisito descrito acima (`REQ-SYNC-014`, `REQ-SYNC-015`, `REQ-SYNC-016`).
- **Não implementado nesta versão**: `propose` (converteria um bundle de `explore` em `delta.md` e tarefas) e `apply` (executaria tarefas uma a uma com `verify` fechando o loop). Nenhum desses dois comandos existe em `src/cli/index.ts`; qualquer menção a eles no README ou em documentos históricos descreve intenção de roadmap, não comportamento presente no código.

## Organização do Código

```
src/
  cli.ts                  # entrypoint do binário (shebang), dispatch de --help/--version/comando
  cli/
    index.ts              # registerCommands(), parsing de argv, USAGE
    exit-codes.ts          # tabela EXIT { OK, GATE_FAILURE, OPERATIONAL_FAILURE }
  core/
    root.ts                # requireProjectRoot — acha o diretório com .specd/
    operational.ts         # OperationalError (exit 2)
    conflict.ts             # erros de conflito compartilhados (P4)
  config/
    resolve.ts              # resolveConfig(): merge CLI > workspace > global > default
    schema.ts                # ConfigSchema, DEFAULT_CONFIG, VERIFY_LEVELS
    errors.ts                # ConfigError
    credentials.ts           # resolução de token via env var
  ears/
    parse.ts, patterns.ts    # parser da gramática EARS
  parser/
    capability.ts             # parseCapability(): frontmatter + requisitos (H3) de um .md de spec
    requirement.ts             # parseRequirement(): statement, acceptance, âncoras
    requirement-id.ts          # validação/prefixo de IDs estáveis (REQ-XXX-NNN)
    delta.ts                   # parser de delta.md (ADDED/MODIFIED/REMOVED)
    task.ts                    # parser de tasks/
    sections.ts, markdown.ts, frontmatter.ts, anchors.ts, diagnostics.ts
  anchors/
    resolve.ts                # resolveAnchor() — a escada de 5 passos
    search.ts                  # findSymbolInRepo() — passo 5 (busca em todo o repo)
    strategy.ts, strategies/grep.ts   # estratégias de resolução por extensão
    suggest.ts                  # anchor suggest <capability | --file>
    fix.ts                       # anchor fix <requirement>
    declarations.ts, model.ts     # tipos de Anchor e declarações
  verify/
    index.ts                    # verify() — orquestra as 6 camadas na ordem fixa
    layers/
      provenance.ts, schema.ts, coverage.ts, anchors.ts, evidence.ts, project.ts
      types.ts                   # VerifyLayer, VerifyLayerContext
    changes.ts                    # readOpenChanges()
    effective.ts                   # effectiveSpecs() — specs + overlay das changes abertas
    report.ts                       # VerifyReport, formatReport()
  explore/
    index.ts                       # explore() — coleta fontes num bundle
    sources/{board,git,http,mcp,index,types}.ts   # coletores por tipo de fonte
    manifest.ts, paths.ts, redact.ts, card-ref.ts
  sync/
    index.ts                        # sync(), findOrphanedLinks(), classifyOrphans(), planActions()
    adapter.ts                       # interface BoardAdapter
    adapters/{redmine.ts, index.ts}    # único adaptador medido: Redmine
    merge.ts, hash.ts, link.ts, mapping.ts, fields.ts, errors.ts
  archive/
    index.ts                          # archive() — aplica delta, arquiva change, --sync opcional
    apply.ts                           # planApplication() — como o delta vira escrita de capability
  status/
    index.ts, changes.ts, locate.ts
  init/
    index.ts, detect-stack.ts, config-template.ts, gitattributes.ts
  hooks/
    install.ts, uninstall.ts, run.ts, protocol.ts, settings.ts

test/
  architecture/    # testes que impõem P1 (no-llm-in-verify), P3 (no-network-in-verify),
                    #   o isolamento de sync em relação a hooks (no-sync-in-hooks),
                    #   e a fronteira de exit codes hooks/specd (hook-exit-codes)
  anchors/, archive/, config/, core/, distribution/, ears/, explore/, hooks/,
  init/, parser/, status/, sync/, verify/     # unitários por área, ~52 arquivos *.test.ts
  fixtures/         # repositórios de teste em miniatura (símbolo movido, ambíguo, arquivo
                    #   ausente, resolvido só por arquivo, resolvido com símbolo)
  integration/redmine/   # sobe um Redmine real em container para test:integration

.specd/
  config.toml        # configuração deste próprio repositório
  specs/              # 10 capabilities realizadas, 103 requisitos ao todo:
                       #   anchors.md(12) archive.md(13) cli.md(7) config.md(11) ears.md(5)
                       #   explore.md(9) hooks.md(7) spec-format.md(10) sync.md(16) verify.md(13)
  changes/
    archive/            # changes encerradas — Fatias 1 a 8 arquivadas neste repositório
                         #   (2026-07-fatia-1 .. 2026-07-fatia-8), cada uma com delta.md,
                         #   proposal.md e tasks/
```

Cada arquivo de capability em `.specd/specs/*.md` abre com frontmatter YAML (`capability`, `retired: []`) e declara requisitos como headings de nível 3 (`### REQ-<PREFIXO>-<NNN> — Título`), cada um com `Statement` em EARS, `Acceptance` (lista de critérios testáveis) e um bloco ```` ```yaml anchors ```` apontando `file` + `symbol`. `parseCapability()` (`src/parser/capability.ts`) é o parser canônico dessa estrutura; ele rejeita frontmatter ausente, requisito duplicado, prefixo de ID incompatível com o nome da capability, e ID reutilizado depois de listado em `retired`.

## Dependências

Dependências de produção, deliberadamente mínimas — refletindo P5 (nenhum botão de configuração ou biblioteca sem necessidade medida):

| Pacote | Uso |
| --- | --- |
| `smol-toml` | Parsing/serialização de `.specd/config.toml` |
| `yaml` | Parsing do frontmatter YAML e dos blocos `yaml anchors` embutidos em Markdown |

Dependências de desenvolvimento:

| Pacote | Uso |
| --- | --- |
| `typescript` | Compilador, também usado por `tsc -p tsconfig.json` no build |
| `typescript-eslint` + `@eslint/js` + `eslint` | Lint |
| `prettier` | Formatação (`npm run format`) |
| `vitest` | Test runner (`npm run test`) |
| `tsx` | Execução de TypeScript sem build prévio, útil em scripts de desenvolvimento |
| `@types/node` | Tipagem de Node para APIs de `fs`, `path`, `os` etc. usadas amplamente |

Não há dependências de framework web, ORM ou cliente de LLM em produção — coerente com P1, que proíbe qualquer módulo alcançável a partir de `verify()` de importar um cliente de LLM, e com a filosofia geral de superfície mínima do projeto.

## Fluxo de Desenvolvimento

O próprio `specd` é o primeiro repositório que seu `verify` valida — dogfooding literal, citado no `config.toml` deste repositório e na camada `project`, que roda `npm run verify` deste mesmo pacote.

**Scripts (`package.json`):**

```bash
npm run build     # tsc -p tsconfig.json
npm run test      # vitest run
npm run lint      # eslint src test
npm run format    # prettier --write .
npm run verify    # format && lint && test && build — offline, sem Docker
npm run test:integration   # test/integration/redmine/run.sh — sobe Redmine em container,
                            # semeia, roda a suíte de integração e derruba
```

`npm run verify` é deliberadamente o mesmo comando que a camada `project` do gate `specd verify` shell-outa para este repositório (`validation_command = ["npm", "run", "verify"]` em `.specd/config.toml`), fechando o loop de dogfooding. `test:integration` é mantido separado de propósito: o gate do specd não pode exigir Docker, senão as cinco camadas offline deixariam de ser offline (P3 em sua forma mais concreta).

**Ciclo de trabalho spec-driven:**

1. A spec é o contrato: ao implementar uma tarefa, o autor lê os requisitos referenciados em `req` no frontmatter da tarefa (em `.specd/changes/<id>/tasks/`) e trata os critérios de aceite como especificação de teste.
2. Requisito de comportamento novo entra pelo `delta.md` de uma change aberta sob `.specd/changes/<id>/`, nunca direto em `.specd/specs/` — só `specd archive` promove um delta a capability.
3. Requisito é maleável enquanto está num delta (dividir, renomear, reescrever é barato ali) e congela ao ser arquivado — depois disso, mudar identificador custa churn de âncora e de rastro.
4. Tarefa marcada `done` precisa de SHA em `evidence.commits` (checado pela camada `evidence` do gate).
5. Antes de `specd archive`, todas as âncoras do escopo em voo da change precisam resolver, independentemente da política de âncora configurada (`graduated`/`lenient`) — arquivar é o momento em que o trabalho para de estar "em progresso".
6. `specd archive <change> [--sync]` aplica o delta às capabilities, escreve os arquivos e move o diretório da change para `.specd/changes/archive/`, deixando tudo **fora do índice git** para revisão antes de virar histórico (P9). `--sync` é opcional e reconcilia o board só depois que as capabilities já foram escritas em disco — nunca automaticamente.

**Convenções de idioma e estilo:** artefatos de infraestrutura e código em inglês; statements EARS usam keywords em inglês como sintaxe fixa, mas a prosa dos requisitos pode ser em qualquer idioma (este repositório usa `pt-BR`, conforme `.specd/config.toml`). Comentários e mensagens de erro do próprio código-fonte são em inglês. Toda âncora criada deve respeitar exatamente o caminho e o símbolo declarados na spec — se o símbolo precisar de outro nome, a spec é atualizada no mesmo commit. Todo critério de aceite vira teste.

**Integração com agentes de IA:** o plugin `feature-dev@claude-plugins-official`, quando instalado, é usado apenas através de seus agents individuais (`code-explorer`, `code-architect`, `code-reviewer`) dentro do ciclo de mudança do OpenSpec — nunca via o comando `/feature-dev` completo neste repositório, porque ele produziria código sem requisito que o reivindique, exatamente a direção de drift que `specd` não detecta (âncora aponta requisito → código; não há verificação na direção oposta). `hooks install` conecta `specd verify --fast` (ou completo, com `--full-on-stop`) a eventos do host de agente, de forma que o gate rode automaticamente, por exemplo, ao final de uma sessão de edição.

**Estado atual do roadmap** (a partir da estrutura real de `.specd/changes/archive/`, que contém oito changes arquivadas nomeadas `2026-07-fatia-1` a `2026-07-fatia-8`): o ciclo `init → explore → verify → status → archive`, mais `sync` e `hooks`, está implementado e coberto por spec e testes. O meio do ciclo original — `propose` (bundle de exploração → delta e tarefas) e `apply` (execução de tarefa por tarefa com `verify` fechando o loop) — permanece fora do escopo especificado e implementado até o momento; nenhum módulo em `src/` os implementa. Duas restrições herdadas seguem valendo: `archive` não chama `sync` automaticamente (só via `--sync` explícito, decisão de uma pessoa) e a interface de adaptador de board foi desenhada para múltiplos fornecedores mas só medida contra Redmine.
