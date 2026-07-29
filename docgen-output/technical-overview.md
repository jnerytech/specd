# Visão Técnica — specd

## Visão Geral da Arquitetura

`specd` é uma CLI TypeScript de spec-driven development cujo diferencial é a **detecção de drift por âncoras**: cada requisito de uma spec declara, em YAML, onde é realizado no código (`file` + `symbol`), e um dos comandos da ferramenta — `specd verify` — resolve cada âncora contra a árvore de trabalho e reprova quando ela deixa de resolver.

A arquitetura é organizada em torno de um princípio estrutural único: **o gate (`specd verify`) é a única superfície que pode reprovar por qualidade, e ela nunca pode depender de um modelo de linguagem nem de rede.** Isso não é uma convenção documental — é imposto por dois testes de arquitetura reais (`test/architecture/no-llm-in-verify.test.ts` e `test/architecture/no-network-in-verify.test.ts`) que percorrem o grafo de imports a partir de `src/verify/index.ts` e falham o CI se qualquer módulo alcançável a partir de `verify()` importar um cliente de LLM ou um módulo de rede (`node:https`, `node:net`, `axios`, `@anthropic-ai/sdk`, `@modelcontextprotocol/*`, etc.). O utilitário que faz essa varredura é `test/architecture/import-graph.ts`, com as funções `collectImportGraph` e `findForbidden`.

O ponto de entrada do binário é `src/cli.ts`, que expõe a função `main(argv, io)`. `main` resolve o nome do comando, procura em `registerCommands()` (um `Map` populado por `src/cli/index.ts`, ~490 linhas) e delega a execução, capturando qualquer exceção não tratada e traduzindo-a em exit code 2 — nunca 1, porque só o gate reprova por qualidade (contrato de exit code descrito abaixo).

O núcleo do produto é o pipeline de seis camadas dentro de `src/verify/`:

```
src/verify/
  index.ts        # orquestra as camadas, aplica LAYER_ORDER
  report.ts        # LayerReport, VerifyReport, formatReport
  changes.ts        # lê as changes abertas em .specd/changes/
  effective.ts       # calcula o conjunto efetivo de specs + deltas
  layers/
    provenance.ts     # contexto obrigatório foi coletado
    schema.ts          # IDs, gramática EARS, referências
    coverage.ts          # todo requisito tem tarefa
    anchors.ts             # toda âncora resolve
    evidence.ts               # tarefa concluída tem commit
    project.ts                  # shell-out ao validation_command do projeto
```

A ordem das camadas é fixa e vem de uma única fonte de verdade, `VERIFY_LEVELS` (definida em `src/config/schema.ts`), reexportada em `src/verify/index.ts` como `LAYER_ORDER`. Isso é uma decisão de arquitetura deliberada: o comentário no código explica que duas listas paralelas com os mesmos seis nomes já haviam divergido (um template de `init` chegou a manter uma terceira lista defasada), então o produto colapsou para uma lista canônica reutilizada em todo lugar. Quais camadas rodam é configurável via `verify.levels` em `.specd/config.toml`; a ordem de execução não é.

Cada camada implementa a interface `VerifyLayer` (`src/verify/layers/types.ts`) e devolve um `LayerReport` com um `status` de quatro valores — `passed`, `failed`, `skipped`, `blocked` — e não três. O quarto valor, `blocked`, existe para representar explicitamente "a camada não conseguiu rodar", distinto tanto de aprovação quanto de reprovação; isso corresponde ao princípio P8 do projeto (ausência de dado não é conformidade) aplicado dentro do próprio relatório do gate. Uma camada `blocked` interrompe o pipeline e o CLI sai com código 2 (falha operacional), não 1.

## Stack Tecnológico

Extraído de `package.json` (nome do pacote `@jnerytech/specd`, versão `0.0.2`) e dos arquivos de configuração de build/lint/teste:

| Categoria | Ferramenta | Versão declarada |
|---|---|---|
| Linguagem | TypeScript | `^6.0.3` |
| Runtime alvo | Node.js | `>=20` (campo `engines`) |
| Sistema de módulos | ESM (`"type": "module"`) | — |
| Compilador | `tsc` (via `tsconfig.json`) | target `ES2022`, module/moduleResolution `NodeNext` |
| Testes | Vitest | `^4.1.10` |
| Lint | ESLint + typescript-eslint | `^10.8.0` / `^8.65.0` |
| Formatação | Prettier | `^3.9.6` |
| Execução de scripts TS em dev | tsx | `^4.23.1` |
| Tipos Node | `@types/node` | `^26.1.2` |
| Parse de TOML (dependência de runtime) | `smol-toml` | `^1.7.1` |
| Parse de YAML (dependência de runtime) | `yaml` | `^2.9.0` |

O projeto não usa nenhum framework de aplicação — é Node puro. As únicas duas dependências de runtime (não-dev) são `smol-toml`, usada para ler `.specd/config.toml` (`src/config/resolve.ts` importa `parse` de `"smol-toml"`), e `yaml`, usada para ler os blocos de front-matter e âncoras (`yaml anchors`) embutidos nos arquivos markdown de spec.

`tsconfig.json` liga um conjunto de flags de rigor acima do padrão: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules` e `verbatimModuleSyntax`. Isso é consistente com o objetivo de determinismo do produto — o compilador é usado como uma camada adicional de garantia sobre o comportamento do CLI, não apenas como transpilador. `outDir` é `dist`, `rootDir` é `src`; o binário publicado (`bin.specd`) aponta para `dist/cli.js`.

`eslint.config.js` usa a API flat config do ESLint 10, compondo `js.configs.recommended` com `tseslint.configs.recommended` e uma regra customizada (`@typescript-eslint/no-unused-vars` com `argsIgnorePattern: "^_"`), ignorando `dist/` e `node_modules/`.

Há duas configurações de Vitest distintas e deliberadamente separadas:

- `vitest.config.ts` — suíte padrão (`test/**/*.test.ts`), excluindo explicitamente `test/integration/**`. O comentário no arquivo é direto sobre o motivo: a suíte de integração precisa de Docker, e o gate (`npm run verify`) não pode depender de um daemon para permanecer "offline" — uma camada offline que depende silenciosamente de um container deixaria de ser offline.
- `vitest.integration.config.ts` — só `test/integration/**/*.test.ts`, com `fileParallelism: false` (porque os testes falam com um único Redmine compartilhado e mutável) e timeouts de 30s.

## Componentes-Chave

**`src/cli/`** — Registro e roteamento de comandos. `src/cli/index.ts` constrói o `Map<string, Command>` consultado por `main()` em `src/cli.ts`, além de exportar a string `USAGE` mostrada em `--help`. Cada comando (`init`, `explore`, `verify`, `status`, `anchor suggest`, `anchor fix`, `archive`, `sync`, comandos de hooks) é um objeto com um método `run(args, io)`.

**`src/verify/`** — O gate. `verify()` (`src/verify/index.ts`) resolve a raiz do projeto via `requireProjectRoot`, resolve a configuração via `resolveConfig`, garante que existe `.specd/specs/` (senão lança `OperationalError` com exit 2 — não passa vazio, ver seção de Segurança/robustez), seleciona as camadas habilitadas com `selectLayers(config.verify.levels)` e as executa em `LAYER_ORDER`, parando no primeiro `failed` ou `blocked`. O resultado é um `VerifyReport` (`src/verify/report.ts`) com `ok`, `layers`, `stoppedAt`, `blocked`, `violations` e `disabled`. `formatReport()` produz a saída textual para stderr quando `--json` está ativo (para manter o stdout limpo para consumo por máquina).

**`src/config/`** — Resolução de configuração em camadas. `resolveConfig()` (`src/config/resolve.ts`) parte de `structuredClone(DEFAULT_CONFIG)` e aplica, em ordem, o arquivo global (`~/.specd/config.toml`), o arquivo de workspace (`<cwd>/.specd/config.toml`) e por fim as flags de CLI — precedência campo a campo via `mergeFields`, guiada pelo `ConfigSchema`: seções recursam, todo o resto (inclusive arrays) é substituído inteiro pela fonte de maior precedência. `src/config/credentials.ts` expõe `resolveToken(tokenEnv, env)`, que lê o token **apenas** da variável de ambiente nomeada em `token_env` e lança `ConfigError` se ela estiver ausente ou vazia — nunca lê token de arquivo de configuração. O mesmo módulo tem `looksLikeToken()`, um detector heurístico de segredos (prefixos conhecidos de GitHub/GitLab/Slack/AWS/JWT, ou blobs longos alfanuméricos) usado defensivamente em outras partes do código para evitar vazar credenciais em relatórios/logs.

**`src/anchors/`** — Resolução, sugestão e correção de âncoras. Contém `resolve.ts`, `search.ts`, `strategy.ts`, `strategies/grep.ts`, `suggest.ts`, `fix.ts`, `declarations.ts` e `model.ts`. A busca por âncora usa uma "escada" de estratégias que inclui listar arquivos via `git ls-files`, com fallback quando o diretório não é rastreado ou é ignorado por um repositório pai — comportamento corrigido explicitamente na Fatia 4 do histórico do projeto (documentado em `CLAUDE.md`, princípio P8), porque um `git ls-files` que retorna vazio silenciosamente esvaziava a rede de segurança de sugestão de âncoras.

**`src/archive/`** — Aplica um `delta.md` de uma change aberta às capabilities em `.specd/specs/`, aposentando IDs removidos. Reescreve arquivos de capability e deliberadamente os deixa fora do índice do git (não faz commit automático) — instância do princípio P9 (operação que custa não acontece em silêncio): o resultado fica onde a revisão humana passa antes de virar histórico.

**`src/ears/`** — Parser da gramática EARS (Easy Approach to Requirements Syntax) usada nos `statement` dos requisitos: cinco padrões (Ubíquo, Evento — `WHEN`, Estado — `WHILE`, Indesejado — `IF/THEN`, Opcional — `WHERE`), cada um exigindo exatamente um `SHALL`.

**`src/explore/`** — Coleta um bundle de contexto de fontes configuráveis (`board`, `git`, `http`, `mcp` — ver `SOURCE_TYPES` em `src/config/schema.ts`) e grava um bundle auditável; é o único ponto, junto de `sync`, onde a ferramenta acessa rede.

**`src/sync/`** — Reconciliação com um board externo. `src/sync/adapters/redmine.ts` implementa a interface `BoardAdapter` (definida em `src/sync/adapter.ts`) contra a API REST do Redmine. A interface foi desenhada para múltiplos fornecedores mas hoje tem exatamente um adaptador real; qualquer suposição sobre Azure DevOps é dedução, não código existente.

**`src/init/`, `src/parser/`, `src/status/`, `src/hooks/`, `src/core/`** — respectivamente: scaffold de `.specd/` e detecção de stack; parsers de markdown/frontmatter para capability/delta/task/requirement/anchors; relatório de drift e pendências (`specd status`); integração com hooks do Claude Code (protocolo, install/uninstall/run, com testes de arquitetura próprios — `no-sync-in-hooks.test.ts`, `hook-exit-codes.test.ts`); e utilitários transversais como detecção da raiz do projeto (`requireProjectRoot`) e a hierarquia de erros operacionais (`OperationalError`, `ConfigError`).

## Fluxo de Dados / Pontos de Integração

O fluxo de dados central é: **spec markdown → parse → verificação estrutural e de âncoras contra o working tree → relatório → exit code.** Não há banco de dados, não há servidor HTTP exposto pelo próprio `specd` — é uma CLI stateless que lê e escreve arquivos dentro de `.specd/` e no restante do repositório.

Pontos de integração externa, todos fora do caminho do gate:

1. **Redmine (via `src/sync/adapters/redmine.ts`)** — `specd sync` fala REST com uma instância Redmine usando `fetch` nativo do Node. As operações implementadas são `create`, `update`, `link`, `close`, `read` e `describeFields`. Cada requisição HTTP inclui o header proprietário `x-redmine-api-key` com o token resolvido via `resolveToken`. A decisão de "o que mudou" nunca vem do timestamp do board (`updated_on` do Redmine sobe por motivos estruturais alheios ao conteúdo, como anexar/remover um filho) — vem de um merge de três vias sobre um `synced_hash` gravado no front-matter da capability. Quando os dois lados (spec e board) mudaram de formas diferentes, `sync` sai com código 2, lista o conflito e não resolve nada sozinho (princípio P4).
2. **Comando de validação do projeto (camada `project`)** — a última das seis camadas do gate delega, via shell-out (`child_process`, deliberadamente fora da lista de módulos proibidos pelo teste `no-network-in-verify`, porque não abre socket), ao `validation_command` configurado em `[verify]` no `config.toml` (ex.: `["make", "lint"]`). É assim que `npm run verify` deste próprio repositório é chamado pela camada `project` de `specd verify` quando ele valida a si mesmo — dogfooding literal.
3. **Fontes de `explore`** — board, git, http, mcp (`SOURCE_TYPES` em `src/config/schema.ts`). `explore` é o outro comando, além de `sync`, autorizado a tocar rede.
4. **git** — usado localmente via shell-out para listar arquivos rastreados (estratégia principal de busca de âncoras) e detectar conflitos.

O contrato de exit code é o ponto de integração mais importante com sistemas externos (CI):

| Código | Significado |
|---|---|
| 0 | Sucesso |
| 1 | Gate reprovou (só `specd verify`) — a spec ou o código estão errados |
| 2 | Falha operacional — rede, I/O, configuração inválida |

Essa distinção é reforçada em `src/cli.ts`: qualquer exceção não tratada que chega ao `catch` de `main()` vira exit 2, nunca 1 — porque só um veredito do gate pode retornar 1 (`REQ-CLI-004`, citado no comentário do código).

## Segurança / Autenticação

O modelo de segurança do `specd` é deliberadamente mínimo e concentrado num único ponto: **credenciais de board nunca vivem em arquivo de configuração.** `resolveToken()` (`src/config/credentials.ts`) lê o token exclusivamente da variável de ambiente nomeada pelo campo `token_env` de `.specd/config.toml` (por exemplo `SPECD_BOARD_TOKEN`); se a variável estiver ausente ou vazia, lança `ConfigError` **antes** de qualquer requisição de rede ser montada — o adaptador Redmine (`createRedmineAdapter`) chama `resolveToken` na sua própria construção, então a falha de credencial acontece antes que o adapter exista, e o token nunca aparece em relatório, log ou erro.

Não há gerenciamento de segredos além disso: sem vault, sem criptografia em repouso, sem rotação automática, sem OAuth. O único mecanismo de defesa adicional é heurístico — `looksLikeToken()` em `src/config/credentials.ts` reconhece padrões de prefixo (`ghp_`, `github_pat_`, `glpat-`, `xox[abprs]-`, `sk-`, `AKIA`, `ya29.`, JWT) e blobs alfanuméricos longos, usado para evitar que segredos vazem acidentalmente em texto exibido pela ferramenta. Isso é uma salvaguarda best-effort, não uma garantia criptográfica.

A autenticação HTTP contra o Redmine é feita via header customizado `x-redmine-api-key`, decisão documentada no código como concentrada num único lugar do codebase ("REQ-SYNC-002"). Não há TLS pinning, retry com backoff exponencial nem circuit breaker visíveis no adaptador — `request()` em `redmine.ts` faz uma chamada `fetch` direta e propaga qualquer erro HTTP não-2xx como `BoardRefusedError`, carregando o corpo da resposta sem parsear (porque mensagens de erro do Redmine são texto localizado sem código estruturado).

Um segundo eixo de "segurança" no sentido amplo do termo é a proteção contra escrita silenciosa em sistema de terceiros. O método `close()` do adaptador Redmine **relê o item após o `PUT`** e falha explicitamente se o status não mudou para o valor esperado — porque, medido empiricamente, um Redmine cujo tracker não tem linha de workflow aceita um `PUT` com `status_id`, responde HTTP 204 e descarta o campo silenciosamente. Isso não é autenticação nem criptografia, mas é parte do modelo de confiança do produto: uma resposta de sucesso de um sistema externo nunca é tratada como prova de que a escrita aconteceu.

Não há superfície de autenticação para o próprio CLI `specd` — é uma ferramenta local, sem usuários, sessões ou controle de acesso próprio; a única "identidade" que importa é a do processo do sistema operacional que executa o comando e tem (ou não) a variável de ambiente do token no seu ambiente.

## Performance

O gate (`specd verify`) é desenhado para ser executado a cada commit e a cada evento `Stop` de um agente de codificação, o que impõe uma restrição de performance dura: **as cinco primeiras camadas (provenance, schema, coverage, anchors, evidence) rodam totalmente offline e em milissegundos**, sem tocar rede e sem depender da stack do projeto sendo verificado — elas operam só sobre os arquivos markdown de `.specd/` e sobre o sistema de arquivos local. Os próprios testes de arquitetura impõem um teto de tempo explícito: tanto `no-llm-in-verify.test.ts` quanto `no-network-in-verify.test.ts` afirmam que percorrer o grafo de imports a partir de `src/verify/index.ts` "completa bem abaixo de dois segundos" (`expect(elapsedMs).toBeLessThan(2000)`), o que reflete a expectativa geral de que a análise estática do próprio pipeline deve ser instantânea, não apenas a execução do gate.

A sexta camada, `project`, é a única exceção de custo: ela delega via shell-out ao `validation_command` configurado (por exemplo, a suíte completa de `npm run verify` deste repositório — format + lint + test + build), cujo tempo de execução é inteiramente determinado pelo projeto-alvo, não pelo `specd`. Essa é uma decisão consciente: separar as camadas rápidas e determinísticas das camadas cujo custo é delegado, para que o custo do gate como um todo seja previsível na parte que o `specd` controla.

Não há otimizações de performance sofisticadas visíveis no código (sem cache persistente entre execuções, sem paralelização explícita entre camadas — elas rodam sequencialmente e param no primeiro `failed`/`blocked`, o que é também uma otimização implícita: uma vez que uma camada reprova, as seguintes nem executam). O adaptador Redmine mantém dois caches em memória de curta duração dentro de uma única chamada (`trackerCache`, `statusCache`) para evitar requisições repetidas a `/trackers.json` e `/issue_statuses.json` na mesma sessão de sincronização — mas isso é otimização de `sync`, um comando fora do gate, e não afeta a performance do caminho crítico de `verify`.

`npm run test:integration` é deliberadamente separado de `npm run test` justamente por razões de performance/infraestrutura: subir um container Docker com Redmine, semear dados e rodar a suíte custa segundos a minutos, incompatível com a exigência de que o gate padrão seja instantâneo e sem dependências externas.

## Infraestrutura

**Não há pipeline de CI configurado neste repositório.** Uma verificação direta confirma a ausência de qualquer diretório `.github/workflows/` (e de `.github/` como um todo) na árvore do projeto — não há GitHub Actions, nem qualquer outro provedor de CI (Circle CI, GitLab CI, Travis) configurado via arquivo de configuração no repositório. A validação hoje é inteiramente local, via dois scripts npm:

- `npm run verify` — executa, em sequência, `format` (Prettier, `prettier --write .`), `lint` (`eslint src test`), `test` (`vitest run`, escopo definido por `vitest.config.ts`, excluindo `test/integration/**`) e `build` (`tsc -p tsconfig.json`). É totalmente offline e não depende de Docker; é o mesmo comando que a camada `project` do gate invoca quando `specd verify` valida este próprio repositório (dogfooding).
- `npm run test:integration` — executa `test/integration/redmine/run.sh`, que sobe um Redmine via `test/integration/redmine/docker-compose.yml`, semeia dados, roda a suíte definida em `vitest.integration.config.ts` (`test/integration/**/*.test.ts`, sem paralelismo entre arquivos, timeouts de 30s) e derruba o container. Este é deliberadamente mantido fora do `npm run verify`, para que o gate principal não passe a exigir Docker.

Distribuição: o pacote é publicado como `@jnerytech/specd` no npm (escopado — o nome sem escopo `specd` estava planejado mas o `package.json` atual usa o escopo `@jnerytech`), com o campo `bin.specd` apontando para `dist/cli.js` e `files: ["dist"]` restringindo o que é publicado no tarball. Segundo o `CLAUDE.md` do repositório, o pacote **ainda não foi publicado no registry**, então `npx specd` responde 404 atualmente; o caminho documentado para uso é clonar o repositório, `npm install && npm run build` e então `node dist/cli.js <comando>`, ou `npm link` uma vez para expor o binário `specd` no PATH local. Há um teste de distribuição (`test/distribution/package.test.ts`, presente no `git status` do repositório como arquivo modificado) que amarra o caminho citado na documentação ao campo `bin` real do `package.json`, evitando que os dois divergam silenciosamente.

Não há ambiente de staging/produção no sentido tradicional: `specd` é uma ferramenta de linha de comando distribuída via registry npm e executada localmente ou em CI de terceiros (o próprio repositório de um usuário do `specd`), não um serviço hospedado. Não há, portanto, infraestrutura de deploy (containers de produção, orquestração, balanceadores) associada ao próprio `specd` — a única infraestrutura containerizada do repositório é o Redmine efêmero usado exclusivamente para a suíte de integração local.
