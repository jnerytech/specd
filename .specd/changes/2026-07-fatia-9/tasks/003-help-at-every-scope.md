---
id: "003-help-at-every-scope"
change: 2026-07-fatia-9
req: [REQ-CLI-010, REQ-CLI-011]
status: pending
evidence:
  commits: []
---

## Objetivo

Fazer `--help` funcionar em todo escopo, tirando o texto da mesma fonte que a recusa por uso incorreto já nomeia — e devolver a esses escopos o detalhe que a task 002 removeu do texto global.

## Escopo

`src/cli/usage.ts` ganha `SCOPE_USAGE`, um texto por escopo, e `renderScopeHelp()`. Os escopos são os nove que hoje têm `throw new UsageError("Usage: ...")` ou tabela de flags própria: `init`, `verify`, `status`, `explore`, `sync`, `archive`, `anchor suggest`, `anchor fix`, `hooks install`, `hooks uninstall`, `hooks run`.

O texto de cada um nasce da string que já está no `throw`, acrescida do bloco `Options for ...` correspondente, que a task 002 tirou do global. As duas metades já existem em prosa; nada aqui é escrito do zero.

As `UsageError` passam a ler `SCOPE_USAGE` em vez de repetir a frase. `--help` lê a mesma constante.

A detecção acontece antes de `parseArguments`/`parseFlags`, porque essas duas lançam em opção desconhecida e `--help` não pode depender de ter sido declarada em cada lista.

## Restrições

- **Dois níveis.** `anchor suggest --help` e `anchor fix --help` são textos diferentes, e `hooks` tem três. `specd anchor --help` sem subcomando imprime o texto do escopo `anchor`, que lista os dois — não é erro
- A precedência é `--help` primeiro, validação depois. `specd verify --nope --help` sai 0
- Nada de trabalho antes da checagem: `sync` e `explore` abrem rede e `archive` reescreve capabilities. Um `--help` avaliado depois da chamada seria a única forma desta fatia custar alguma coisa, e é P9
- `hooks run` responde no contrato do host e não no do specd (REQ-HOOK-005). `hooks run --help` é pedido de ajuda, não invocação do host: sai 0 no contrato do specd, sem chamar `runHook`. Os dois contratos se encontram dentro de `runHook`, e `--help` não chega lá
- A recusa continua saindo 2. Só o pedido explícito sai 0
- Uma cópia por escopo. Se a implementação deixar o texto em dois lugares, o teste de REQ-CLI-011 tem que pegar — comparar o que `--help` imprime com o que a `UsageError` do mesmo escopo carrega, e não com um literal repetido no teste

## Critérios de aceite

- Os onze escopos respondem `--help` com o próprio texto e saem 0
- `anchor suggest --help` difere de `anchor fix --help`; os três de `hooks` diferem entre si
- `specd verify --nope --help` sai 0 e imprime a ajuda de `verify`
- Nenhum escopo lê spec, escreve arquivo ou abre conexão quando `--help` está presente
- Para cada escopo, o texto de `--help` é o mesmo objeto que a `UsageError` daquele escopo nomeia
- `specd explore` sem `--change` continua saindo 2, agora com o texto completo do escopo
- Nenhum escopo retorna 1 em nenhum desses caminhos
- Os blocos `Options for ...` estão acessíveis outra vez, agora por `specd <cmd> --help`
