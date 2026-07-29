---
id: "005-command"
change: 2026-07-29-read-aloud
req: [REQ-READ-006]
status: pending
evidence:
  commits: []
---

## Objetivo

`specd read` na CLI, com a URL impressa e o navegador atrás de flag.

## Escopo

`src/read/index.ts` amarra coleta, documento e servidor. `readCommand` entra na
tabela de `registerCommands`, com `--all`, `--full`, `--port` e `--open`, e o
escopo de help correspondente. `openInBrowser` usa o abridor do sistema por
`child_process`, sem dep nova.

A URL é impressa assim que o `listen` confirma, antes de qualquer abertura.

## Restrições

- Exit 0 ou 2, nunca 1: `read` não emite veredito, e single-gate é o motivo
- `--open` nomeia a abertura na saída antes de abrir; sem a flag, nada é lançado
- Falha do abridor reporta e o servidor continua de pé
- Toda flag desconhecida é `UsageError` com o help do escopo, como no resto da
  CLI (REQ-CLI-011)
- Sem `--open` o comando não lança processo nenhum, e é assim que o teste o
  exercita ponta a ponta
