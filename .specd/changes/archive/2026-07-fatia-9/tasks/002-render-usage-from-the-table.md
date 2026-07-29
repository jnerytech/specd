---
id: "002-render-usage-from-the-table"
change: 2026-07-fatia-9
req: [REQ-CLI-009]
status: done
evidence:
  commits: ["f2ecf8e"]
---

## Objetivo

Trocar o literal de 44 linhas por renderização a partir da tabela registrada, e fazer as opções globais entrarem no texto pela mesma porta.

## Escopo

Nasce `src/cli/usage.ts` com `renderUsage()`. A lista de comandos vem de `registerCommands()` — `name` mais `summary`, o campo que estava definido em nove comandos e lido em nenhum. As opções globais vêm de uma tabela declarada ao lado dos pontos de entrada que `main()` trata antes do dispatch, para que `--help`, `-h`, `--version` e `-v` deixem de existir só no `if`.

Cabeçalho, rodapé e a ressalva sobre `hooks run` continuam string à mão dentro de `usage.ts`.

`src/cli/index.ts` deixa de exportar `USAGE` como literal e passa a exportar o resultado da renderização, ou `renderUsage` direto — o que não obrigar `src/cli.ts` a mudar de forma.

## Restrições

- Ordem de listagem é a de `registerCommands()`, que hoje já é a ordem de leitura pretendida. Não ordenar alfabeticamente: `init` antes de `verify` é intencional
- Os blocos `Options for ...` **saem** nesta task, sem destino ainda. Eles reaparecem em 003, no escopo a que pertencem. Entre as duas tasks o detalhe fica indisponível, e é por isso que 003 não é opcional
- `summary` de alguns comandos hoje está mais curto que a linha correspondente no literal — `status` é "Report drift and pending work" no campo e "Report drift and pending work, grouped by change" no texto. O campo vence, e onde ele empobrecer a linha, editar o campo, não reintroduzir literal
- Os argumentos posicionais que o literal mostra (`explore <card> --change <name>`) não cabem em `summary`. Eles vão para o texto de escopo em 003; aqui o global fica só com nome e resumo, e encolher é o resultado esperado
- `test/cli.test.ts:65` afirma `"Usage: specd <command>"`. Essa linha é prosa de cabeçalho e permanece
- O teste novo é sobre a costura, não sobre o invariante: falha se a lista voltar a ser literal, ou se um ponto de entrada em `main()` não estiver na tabela de opções globais

## Critérios de aceite

- Toda chave de `registerCommands()` aparece no texto com seu `summary`
- `--help`, `-h`, `--version` e `-v` aparecem no texto
- Comando acrescentado ao mapa num teste aparece no texto renderizado sem edição de string
- O rodapé sobre `hooks run` e o contrato de exit code continua palavra por palavra
- Nenhum bloco `Options for ...` sobra no texto global
- `specd`, `--help`, `-h` e `help` continuam imprimindo o mesmo texto entre si
- A suíte da task 001 passa sem edição, exceto onde ela afirme ausência de `--version` no texto
