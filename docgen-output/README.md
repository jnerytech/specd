# specd

**Spec-driven development com detecção de drift por âncoras.**

`specd` é uma CLI de spec-driven development escrita em TypeScript. Seu
diferencial não é gerar specs — é fazer a spec quebrar o build quando ela
deixa de descrever o código. Cada requisito declara uma ou mais **âncoras**
(arquivo + símbolo) que apontam para onde ele é implementado, e `specd verify`
resolve cada âncora contra o working tree a cada execução. Âncora que deixa de
resolver é drift, e drift reprova o gate com exit code 1.

```
REQ-AUTH-003: âncora pendurada
  esperado:   src/Auth/TokenService.php :: function rotate
  encontrado: src/Auth/RefreshService.php :: function rotate
  → specd anchor fix REQ-AUTH-003
```

A maioria das ferramentas de SDD trata a spec como prompt: ela guia o agente
na hora de escrever o código e depois apodrece, porque nada verifica se ela
continua verdadeira. O `specd` inverte essa relação — a spec é um artefato
load-bearing, checável em CI, com o mesmo poder de veto que um teste.

## Visão Geral

O projeto implementa um ciclo de desenvolvimento guiado por especificação:

```
explore → propose → apply → archive
   ↑                           ↓
   └──────── specd verify ─────┘
```

- **`explore`** reúne contexto de fontes configuradas (board, ADRs, transporte
  MCP) e grava um bundle auditável em `.specd/changes/<id>/explore/`.
- **`propose`** converteria o bundle num `delta.md` e num conjunto de tarefas.
  **Não está implementado nesta versão do repositório** — ver a seção
  "Status e Roadmap" abaixo.
- **`apply`** executaria o delta tarefa por tarefa, com `specd verify`
  fechando o loop a cada passo. **Também não está implementado.**
- **`archive`** aplica o `delta.md` de uma change às capabilities em
  `.specd/specs/` e arquiva o diretório da change.
- **`specd verify`** é o único comando que reprova (exit 1). É o gate: seis
  camadas ordenadas — `provenance`, `schema`, `coverage`, `anchors`,
  `evidence`, `project` — cada uma desligável via `.specd/config.toml`.

O repositório pratica dogfooding: `.specd/specs/` descreve o próprio `specd`
em dez capabilities (`anchors`, `archive`, `cli`, `config`, `ears`, `explore`,
`hooks`, `spec-format`, `sync`, `verify`), e `npm run verify` — chamado pela
camada `project` do próprio gate — valida este repositório a cada commit.

### Princípios invioláveis

Nove princípios (P1–P9), detalhados em `CLAUDE.md`, orientam toda decisão de
design. Os mais visíveis para quem usa a ferramenta:

| #   | Princípio                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | A CLI nunca chama LLM no caminho de decisão — nenhum módulo alcançável a partir de `verify()` importa cliente de LLM, e há teste de arquitetura para isso                |
| P2  | Um único gate: só `specd verify` retorna 1 por reprovação de qualidade                                                                                                   |
| P3  | O gate nunca acessa a rede — `explore` e `sync` acessam, `verify` não                                                                                                    |
| P4  | Nunca adivinhar em conflito: âncora ambígua ou merge inconsistente sai com erro e diagnóstico, nunca auto-resolução                                                      |
| P7  | Âncora é necessária, nunca suficiente — prova que existe código no caminho declarado, não que ele satisfaz o requisito                                                   |
| P8  | Ausência de dado não é conformidade — todo capacidade que lê estado externo distingue "certo", "errado" e "não consegui verificar", e o terceiro nunca é verde           |
| P9  | Operação que custa alguma coisa não acontece em silêncio — `archive` e `anchor fix` reescrevem arquivos e deixam tudo fora do índice, para revisão antes de virar commit |

## Funcionalidades

- **Verificação de drift por âncoras.** `specd verify` resolve cada âncora
  declarada nos requisitos contra o código real, camada `anchors` do gate
  (`src/verify/layers/`).
- **Gate em seis camadas independentes**, configuráveis em
  `[verify].levels` no `.specd/config.toml`: `provenance` (contexto
  obrigatório foi coletado), `schema` (IDs, gramática EARS, referências),
  `coverage` (todo requisito tem tarefa), `anchors` (toda âncora resolve),
  `evidence` (tarefa concluída tem commit) e `project` (shell-out ao comando
  de validação do projeto, ex.: `npm run verify`).
- **Requisitos em EARS.** Cinco padrões sintáticos (Ubíquo, Evento, Estado,
  Indesejado, Opcional) validados por um parser dedicado (`src/ears/`,
  `src/parser/`) — um comportamento por requisito, dois `SHALL` no mesmo
  statement reprovam.
- **Sugestão e correção de âncora.** `specd anchor suggest` procura
  candidatos de âncora por capability ou por arquivo; `specd anchor fix`
  reescreve uma âncora pendurada para o local sugerido, sem commitar.
- **Sincronização com board externo.** `specd sync` reconcilia a spec com um
  board (hoje, adaptador Redmine em `src/sync/adapters/`) via merge de três
  vias sobre um `synced_hash` gravado no frontmatter da capability — nunca
  automático, sempre chamado manualmente, porque escreve em sistema de
  terceiro.
- **Hooks para agentes de IA.** `specd hooks install` registra o `specd` em
  `.claude/settings.json` como hook de host (ex.: evento `Stop`), para que o
  gate rode ao final de uma sessão de agente sem intervenção manual.
- **Relatórios legíveis e machine-readable.** `verify`, `status`, `sync` e
  `anchor suggest` aceitam `--json` para emitir o relatório completo em
  stdout (com a versão humana redirecionada a stderr quando `--json` está
  ativo).
- **Distribuição zero-install.** O pacote publicado embarca só `dist/`, sem
  `src/`, sem `tsconfig.json` e sem scripts de lifecycle (`prepare`,
  `install`, `postinstall`) — coberto por `test/distribution/package.test.ts`.

## Pré-requisitos

- **Node.js >= 20** (`engines.node` em `package.json`). O pacote é ESM puro
  (`"type": "module"`).
- **npm** para instalar dependências e rodar os scripts do projeto.
- **git**, porque a busca de âncora e o `status` inspecionam o repositório
  via `git ls-files`.
- **Docker**, apenas para `npm run test:integration` (sobe um Redmine real
  para exercitar o adaptador de sync). Não é necessário para instalar, usar
  ou validar o `verify` do dia a dia — o gate é deliberadamente offline
  (P3).

Dependências de produção do próprio `specd` são deliberadamente enxutas:
apenas `smol-toml` (parser de `.specd/config.toml`) e `yaml` (parser dos
blocos de âncora e frontmatter). Nenhuma dependência de cliente LLM chega ao
runtime — consequência direta de P1.

## Instalação

### Publicado no npm

O pacote está registrado no npm sob o escopo `@jnerytech/specd` (o
`package.json` deste repositório declara `"name": "@jnerytech/specd"`, e as
versões `0.0.0` e `0.0.1` já estão publicadas no registry — verificado com
`npm view @jnerytech/specd versions` durante a escrita deste documento). A
versão local em `package.json` (`0.0.2`) pode estar à frente do que já foi
publicado; confirme com o mesmo comando antes de depender de uma feature
recente.

```bash
npm install -g @jnerytech/specd
specd --help
```

Ou, sem instalação global:

```bash
npx @jnerytech/specd --help
```

> **Atenção ao nome do binário.** O binário instalado chama-se `specd`.
> Existe um projeto não relacionado, também chamado SpecD, publicado como
> `@specd/cli`. Não há afiliação entre os dois — se ambos estiverem
> instalados globalmente, um sombreia o outro no PATH.

### A partir do código-fonte (recomendado durante o desenvolvimento)

Como a publicação ainda está em andamento (ver a nota acima e a seção de
Status), o caminho mais confiável para acompanhar o `HEAD` do repositório é
rodar do clone:

```bash
git clone https://github.com/jnerytech/specd.git
cd specd
npm install
npm run build
node dist/cli.js --help
```

Para apontar o `specd` construído localmente contra outro repositório:

```bash
cd /caminho/do/seu/projeto
node /caminho/do/specd/dist/cli.js init
```

Ou registrar o binário local no PATH uma vez, para usar `specd` como nos
exemplos abaixo:

```bash
cd /caminho/do/specd && npm link
```

## Uso

Todos os comandos, flags e o texto de uso oficial vivem em
`src/cli/index.ts` (constante `USAGE`), que é a fonte de verdade — o que
segue é um resumo com exemplos.

### Inicializar um repositório

```bash
specd init                 # escreve .specd/config.toml e a árvore .specd/
specd init --force         # sobrescreve um config.toml existente
```

### Rodar o gate

```bash
specd verify                # roda as seis camadas, formato legível em stdout
specd verify --fast         # pula a camada `project` (o shell-out de validação)
specd verify --json         # relatório completo em JSON no stdout; texto humano vai para stderr
```

Exit codes de `verify`: `0` gate passou, `1` gate reprovou (drift, requisito
sem cobertura, etc.), `2` uma camada não conseguiu rodar — falha
operacional, não veredito de qualidade (P8: "não consegui verificar" nunca é
verde).

### Ver o estado atual

```bash
specd status                # drift e trabalho pendente, agrupado por change
specd status --json
```

`status` sempre sai `0` — ele informa, não julga (só `verify` reprova, P2).

### Coletar contexto para uma change

```bash
specd explore CARD-123 --change 2026-08-minha-fatia
specd explore CARD-123 --change 2026-08-minha-fatia --json
```

Grava um bundle auditável em
`.specd/changes/2026-08-minha-fatia/explore/`. Se uma fonte marcada
obrigatória falhar, `explore` sai com código `2` — nunca inicia o trabalho
sobre contexto incompleto.

### Sincronizar com o board

```bash
specd sync                  # reconcilia spec e board de verdade
specd sync --dry-run         # planeja e reporta sem escrever em nenhum dos dois lados
specd sync --json
```

`sync` nunca roda por hook — é chamado manualmente porque escreve num
sistema de terceiro (comentário, anexo e apontamento de hora de um card não
voltam se algo for fechado por engano).

### Arquivar uma change

```bash
specd archive 2026-08-minha-fatia            # aplica o delta às capabilities
specd archive 2026-08-minha-fatia --sync     # e reconcilia o board em seguida
```

O resultado fica **fora do índice do git** de propósito — `archive` nunca
commita sozinho (P9): "review the diff before it becomes history."

### Âncoras

```bash
specd anchor suggest minha-capability        # candidatos de âncora para uma capability
specd anchor suggest minha-capability --json
specd anchor suggest --file src/foo/bar.ts   # o que este arquivo declara
specd anchor fix REQ-FOO-003                 # reescreve a âncora pendurada; não commita
```

### Hooks para agentes

```bash
specd hooks install                          # registra o hook em .claude/settings.json
specd hooks install --full-on-stop           # roda o Stop hook sem --fast
specd hooks install --force                  # substitui uma entrada specd divergente
specd hooks install --command "node dist/cli.js"
specd hooks uninstall
specd hooks run Stop                         # adaptador chamado pelo host; não se roda à mão
```

`hooks run` é a única exceção ao contrato de exit code do specd: ela
responde na convenção de hook do host, documentada em
`src/hooks/protocol.ts`.

### Ajuda e versão

```bash
specd help
specd --help
specd --version
```

## Estrutura do Projeto

```
specd/
├── src/
│   ├── cli.ts                # entrypoint do binário (dist/cli.js aponta para cá)
│   ├── cli/                  # registro de comandos, parsing de argv, USAGE (index.ts, exit-codes.ts)
│   ├── anchors/               # resolução, sugestão e correção de âncoras (+ strategies/)
│   ├── archive/                # aplica delta.md às capabilities, arquiva a change
│   ├── config/                 # parser e resolver de .specd/config.toml
│   ├── core/                   # tipos e utilidades compartilhadas
│   ├── ears/                   # gramática dos cinco padrões EARS
│   ├── explore/                 # coleta de bundles a partir de fontes configuradas (+ sources/)
│   ├── hooks/                   # install/uninstall/run do hook para agentes de IA
│   ├── init/                    # scaffolding de .specd/
│   ├── parser/                   # parser de spec/delta/frontmatter/capability
│   ├── status/                    # relatório de drift e trabalho pendente
│   ├── sync/                       # reconciliação spec ↔ board (+ adapters/, hoje Redmine)
│   └── verify/                     # o gate: verify() e as seis camadas (verify/layers/)
├── test/                        # espelha src/, mais architecture/, distribution/, fixtures/, integration/
├── .specd/
│   ├── config.toml              # configuração deste repositório (dogfooding)
│   ├── specs/                    # a verdade: capabilities realizadas (anchors.md, archive.md, cli.md, config.md, ears.md, explore.md, hooks.md, spec-format.md, sync.md, verify.md)
│   └── changes/
│       ├── archive/               # changes encerradas (fatias 1 a 8, ao momento desta geração)
│       └── ...                    # changes abertas, quando houver
├── docs/history/                 # o documento de proposta original, superado, com IDs BL-*
├── dist/                          # saída de `tsc`, é o que é publicado (gerado, não versionado)
├── package.json
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts / vitest.integration.config.ts
└── CLAUDE.md / AGENTS.md          # instruções e princípios para agentes que trabalham neste repo
```

Cada subdiretório de `src/` corresponde a uma capability de
`.specd/specs/`, e é isso que as âncoras dos requisitos apontam — por
exemplo, REQ-SYNC-014 (fechamento de item de board) tem âncora em
`src/sync/index.ts :: export function findOrphanedLinks`.

## Configuração

Toda configuração vive em `.specd/config.toml`, versionado no repositório —
nunca em `~/`. Exemplo real, o `.specd/config.toml` deste próprio
repositório:

```toml
[project]
client = "jnerytech"
language = "pt-BR"

[verify]
levels = ["provenance", "schema", "coverage", "anchors", "evidence", "project"]
validation_command = ["npm", "run", "verify"]

[verify.anchors]
policy = "graduated"

[anchors]
default = "grep"

[memory]
enabled = true
change_limit_lines = 150
task_limit_lines = 200
```

Chaves relevantes:

- **`[project]`** — metadados do repositório sendo especificado (`client`,
  `language` da prosa dos requisitos; as keywords EARS continuam em inglês
  independentemente disso).
- **`[verify].levels`** — quais das seis camadas do gate rodam. Removê-las
  daqui é a forma de desligar uma camada — nunca por flag isolada de linha de
  comando (P5: botão de configuração só existe quando dois clientes reais
  divergem).
- **`[verify].validation_command`** — o comando shellado pela camada
  `project`, tipicamente o `verify`/`lint`/`test` do próprio projeto sendo
  especificado.
- **`[verify.anchors].policy`** — política de gravidade para âncora
  pendurada. `"graduated"` distingue: pendurada em `.specd/specs/` é erro,
  pendurada num `delta.md` de change aberta é warning (requisito ainda em
  voo é maleável por design).
- **`[anchors].default`** — estratégia padrão de resolução de âncora
  (`src/anchors/strategies/`); `"grep"` é a estratégia sem dependência de
  parser de linguagem.
- **`[memory]`** — limites de tamanho para os artefatos efêmeros de memória
  de change/task (`change_limit_lines`, `task_limit_lines`). Memória é
  efêmera por princípio (P6); verdade durável vai para `.specd/specs/` ou
  para um ADR.
- **`[board]` e `[board.mapping]` / `[[board.fields]]`** — configuração do
  adaptador de board usado por `sync` (exemplo no README original do
  projeto, não usado neste próprio repositório porque ele não sincroniza
  com um board de terceiro):

```toml
[board]
provider = "redmine"
url = "https://redmine.exemplo/"
project = "meu-projeto"
token_env = "SPECD_BOARD_TOKEN"

[board.mapping]
capability = "Epic"
requirement = "Story"
collapse = ["task"]

[[board.fields]]
name = "Cliente"
constant = "ACME"
```

Segredos de board (token de API) nunca ficam no arquivo — `token_env` nomeia
a variável de ambiente que carrega o valor.

## Contribuindo

Este repositório é o próprio produto praticando o método que vende: **a
spec é o contrato.** Antes de implementar qualquer tarefa:

1. **Leia `CLAUDE.md` e `AGENTS.md`** na raiz do repositório. Eles descrevem
   os nove princípios invioláveis (P1–P9), o contrato de exit code e as
   convenções de idioma e âncora — não são preferências de estilo, são
   regras que, se violadas, quebram a proposta de valor do produto.
2. **Requisito novo entra pelo delta, não direto na spec.** `.specd/specs/`
   contém só verdade já realizada (Modelo B). Comportamento que ainda não
   existe em código mora no `delta.md` de uma change aberta em
   `.specd/changes/<id>/`, e só migra para `.specd/specs/` quando `specd
archive` aplica o delta.
3. **Trate os critérios de aceite como especificação de teste.** Toda tarefa
   marcada `done` precisa de um SHA em `evidence.commits` — é o que a
   camada `evidence` do gate verifica.
4. **Respeite a âncora como contrato.** Ao criar um módulo referenciado por
   uma âncora, use exatamente o caminho e o símbolo declarados na spec. Se
   o símbolo precisar de outro nome, atualize a spec no mesmo commit.
5. **Rode `npm run verify` antes de propor qualquer mudança:**

   ```bash
   npm run verify            # format (prettier) + lint (eslint) + test (vitest) + build (tsc) — offline
   npm run test:integration  # sobe um Redmine em Docker e roda a suíte de integração do adaptador
   ```

   Os dois são separados de propósito: o gate do próprio `specd` não pode
   exigir Docker, senão as camadas offline deixariam de ser offline (P3).

6. **Comentários e mensagens de erro em inglês; prosa de requisito no
   idioma configurado em `[project].language`.** Keywords EARS (`WHEN`,
   `SHALL`, `IF`, `THEN`, `WHILE`, `WHERE`) são sintaxe fixa em inglês
   independentemente do idioma da prosa.
7. **Escopo atual não inclui `propose`, `apply` nem memória durável** — não
   implemente essas capabilities fora de uma change com delta explícito;
   ver a seção seguinte.

Não há um arquivo `CONTRIBUTING.md` separado neste repositório — `CLAUDE.md`
e `AGENTS.md` cumprem esse papel para colaboradores humanos e para agentes
de IA igualmente.

## Status e Roadmap

O ciclo `explore → verify → archive`, mais `sync` e os hooks, está
implementado e testado. Na árvore de `.specd/changes/archive/` há, ao
momento desta geração, oito fatias encerradas
(`2026-07-fatia-1` a `2026-07-fatia-8`), cobrindo:

| Fatia | Escopo entregue (resumo)                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------- |
| 1     | `init`, `explore`, `verify`, `status`, `anchor suggest`                                                               |
| 2     | `archive`, `anchor fix`, camadas `coverage` e `evidence`                                                              |
| 3     | camada `provenance`, transporte MCP                                                                                   |
| 4     | raiz do projeto, listagem com fallback, detecção de stack .NET                                                        |
| 5     | hooks, `anchor suggest --file`                                                                                        |
| 6     | `sync`, adaptador Redmine                                                                                             |
| 7     | `archive --sync`, exigência de morte declarada para fechar item de board                                              |
| 8     | recusa de fechamento quando o corpo do item reaparece sem ligação; morte proposta (não arquivada) deixa o card em paz |

**`propose` e `apply` não estão implementados neste repositório.** Não
existe código em `src/` para nenhum dos dois comandos, e eles não aparecem
no `USAGE` de `src/cli/index.ts` nem em `registerCommands()`. Hoje, a
transição de contexto explorado para `delta.md` e tarefas é manual, e a
execução de tarefas contra o código também é manual — `specd verify` fecha o
loop de qualidade em qualquer um dos dois casos, mas nenhum dos dois
comandos automatiza a etapa anterior.

A interface de adaptador de board foi desenhada para múltiplos
fornecedores, mas hoje só o Redmine (`src/sync/adapters/`) tem
implementação real — qualquer afirmação sobre suporte a outro provedor
(ex.: Azure DevOps) seria dedução, não medição.

## Licença

MIT — ver `LICENSE`.

## Nota de desambiguação

Existe um projeto não relacionado chamado SpecD, publicado no registry npm
como `@specd/cli` por outros autores (`specd-sdd/SpecD`). Não há afiliação
entre os dois projetos. O único ponto de contato técnico é o nome do
binário — `specd` — que, se ambos os pacotes estiverem instalados
globalmente, faz um sombrear o outro no PATH.
