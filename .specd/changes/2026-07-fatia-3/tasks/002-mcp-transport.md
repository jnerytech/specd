---
id: "002-mcp-transport"
change: 2026-07-fatia-3
req: [REQ-EXP-009]
status: pending
evidence:
  commits: []
---

## Objetivo

Transporte do coletor MCP

## Escopo

Requisito para o comportamento que a Fatia 1 já implementou: modo de resposta JSON, SSE marcado como falha.

## Restrições

- SSE fora de escopo, e o requisito é o registro disso
- Nenhum payload parcial é gravado a partir de stream
- A âncora resolve desde antes desta task; o que faltava era o requisito, não o código
