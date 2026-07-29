---
id: "002-mcp-transport"
change: 2026-07-28-provenance-and-mcp-transport
req: [REQ-EXP-009]
status: done
evidence:
  commits: ["e59b79667ba4edee66a3c32156868eaba95b88f8"]
---

## Objetivo

Transporte do coletor MCP

## Escopo

Requisito para o comportamento que a change `verify-gate-and-anchor-ladder` já implementou: modo de resposta JSON, SSE marcado como falha.

## Restrições

- SSE fora de escopo, e o requisito é o registro disso
- Nenhum payload parcial é gravado a partir de stream
- A âncora resolve desde antes desta task; o que faltava era o requisito, não o código
