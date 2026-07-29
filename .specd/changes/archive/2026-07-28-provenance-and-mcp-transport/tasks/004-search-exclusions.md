---
id: "004-search-exclusions"
change: 2026-07-28-provenance-and-mcp-transport
req: [REQ-ANC-003]
status: done
evidence:
  commits: ["e59b79667ba4edee66a3c32156868eaba95b88f8"]
---

## Objetivo

Busca de fallback ignora árvores que citam sem declarar

## Escopo

`SEARCH_EXCLUDE_PREFIXES` passa a excluir `openspec/` e `docs/` além de `.specd/`.

## Restrições

- Toda âncora com símbolo escreve esse símbolo na capability que a declara
- Sem a exclusão, âncora pendurada é encontrada no arquivo que a declarou e match verdadeiro parece ambíguo
- O critério novo documenta comportamento que já existia sem requisito
