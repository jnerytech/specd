---
id: "004-suggest-by-file"
change: 2026-07-28-hooks-enforce-the-gate
req: [REQ-ANC-012]
status: done
evidence:
  commits: ["f317113142e82f2acdbc3e1ed213cc1e253d437a"]
---

## Objetivo

`specd anchor suggest --file <caminho>` lista as declarações do arquivo.

## Escopo

`src/anchors/declarations.ts` com uma tabela de padrões por extensão. Ramo novo no comando `anchor suggest`; o modo por capability fica intacto.

## Restrições

- Determinístico: mesma árvore, mesma saída, na ordem do arquivo
- Nenhum nome composto — só texto literal do arquivo
- Extensão desconhecida reporta que não há padrão, e não devolve lista vazia
