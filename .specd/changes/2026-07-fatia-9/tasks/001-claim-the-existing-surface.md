---
id: "001-claim-the-existing-surface"
change: 2026-07-fatia-9
req: [REQ-CLI-008]
status: pending
evidence:
  commits: []
---

## Objetivo

Pôr sob teste a superfície de help e version que já roda sem requisito, antes que as tasks 002 e 003 a refatorem.

## Escopo

Nenhuma mudança de comportamento. `test/cli/help.test.ts` passa a exercer os seis pontos de entrada — `specd` sem argumento, `--help`, `-h`, `help`, `--version`, `-v` — pelo mesmo helper `cli()` que `test/cli.test.ts` já usa, contra um workspace **sem** `.specd/`, para que a ausência de leitura de spec seja demonstrada e não afirmada.

Âncora de REQ-CLI-008 aponta para `main` em `src/cli.ts`, que já existe. A task não a move.

## Restrições

- Vem primeiro porque 002 e 003 mexem em `USAGE` e no dispatch, e refatorar sob rede é a diferença entre notar uma regressão e descobri-la em outra fatia
- Rodar num workspace sem `.specd/` é o ponto: um diretório sem spec faz `verify` sair 2 por P8 instância 1, então se algum caminho de help lesse spec o teste falharia por isso
- O teste de `--version` continua sendo o único que precisa de processo de verdade, porque a versão vem de `require("../package.json")` e o helper in-process não distingue isso — `test/cli.test.ts:53` já tem a forma e é reaproveitada
- Não corrigir a ausência de `--version` no texto de uso aqui. Isso é 002, e o teste desta task não deve afirmar o texto atual a ponto de travar a renderização que vem depois
- Zero edição em `src/`

## Critérios de aceite

- Os quatro caminhos de ajuda imprimem texto idêntico em stdout e saem 0
- `--version` e `-v` imprimem `specd <version>` de `package.json` e saem 0
- Todos os seis rodam num diretório sem `.specd/` e saem 0 mesmo assim
- Nenhum deles escreve arquivo no workspace
- `specd nope` continua saindo 2 com o texto em stderr
- A suíte existente passa sem edição
