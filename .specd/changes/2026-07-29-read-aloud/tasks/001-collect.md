---
id: "001-collect"
change: 2026-07-29-read-aloud
req: [REQ-READ-001, REQ-READ-002]
status: pending
evidence:
  commits: []
---

## Objetivo

Decidir quais arquivos entram, e recusar quando não entra nenhum.

## Escopo

`src/read/collect.ts` com duas funções puras sobre o sistema de arquivos:
`collectDefault(root, { all })` monta a seleção de `.specd/` reusando
`readOpenChanges` de `src/verify/changes.ts` — a lista de changes abertas já
existe e já sabe excluir `ARCHIVE_DIRECTORY`, então não se escreve uma segunda.
`collectPaths(cwd, paths)` aceita arquivo ou diretório e varre recursivamente
só `.md`.

As duas devolvem a mesma forma: lista de `{ absolutePath, displayPath }` já
ordenada, para que o documento não tenha que reordenar nada.

## Restrições

- `readOpenChanges` é a fonte da exclusão do archive; duplicar a regra é criar
  um segundo lugar onde ela pode divergir
- Varredura de diretório arbitrário pula `.git` e `node_modules`, e nada mais —
  sem `.gitignore`, sem dep nova
- Conjunto vazio é erro operacional com mensagem que nomeia onde procurou, não
  lista vazia devolvida em silêncio
- `--all` só existe no caminho do default; em caminho explícito não tem efeito
- Ordem determinística sai daqui pronta, não do consumidor
