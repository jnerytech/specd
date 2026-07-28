---
id: "004-search-exclusions"
change: 2026-07-fatia-3
req: [REQ-ANC-003]
status: pending
evidence:
  commits: []
---

## Objetivo

Busca de fallback ignora árvores que citam sem declarar

## Escopo

`SEARCH_EXCLUDE_PREFIXES` passa a excluir `openspec/` e `docs/` além de `.specd/`.

## Restrições

- Toda âncora com símbolo escreve esse símbolo na capability que a declara
- Sem a exclusão, âncora pendurada é encontrada no arquivo que a declarou e match verdadeiro parece ambíguo
- O critério novo documenta comportamento que já existia sem requisito
