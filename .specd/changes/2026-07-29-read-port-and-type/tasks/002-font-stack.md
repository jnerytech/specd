---
id: "002-font-stack"
change: 2026-07-29-read-port-and-type
req: [REQ-READ-010]
status: done
evidence:
  commits: ["4ae82fd3738cff13f6784020f7e3d9520ab45a5b"]
---

## Objetivo

Dar ao documento a cara de Markdown renderizado, sem buscar fonte na rede.

## Escopo

`FONT_STACK` em `src/read/document.ts`, com a pilha de interface do sistema —
`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Noto Sans`, `Helvetica`,
`Arial`, terminando em `sans-serif` — e a monoespaçada correspondente,
terminando em `monospace`. `STYLE` passa a lê-las em vez de citar `Georgia`.

Corpo em `16px` e entrelinha `1.5`, que é a métrica dos previews de Markdown.

## Restrições

- Zero `@font-face` e zero `@import`: nada de rede, porque REQ-READ-005 diz que
  nada sai da máquina e CSS é o caminho que ninguém inspeciona
- Toda pilha termina em família genérica, então sistema sem nenhuma das
  nomeadas ainda renderiza
- `h2.file` continua monoespaçada: é caminho de arquivo, e caminho é literal
- Teste afirma a pilha que o specd escreve, nunca paridade com o GitHub — fato
  de terceiro não vira critério de aceite
