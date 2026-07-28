---
id: "001-provenance"
change: 2026-07-fatia-3
req: [REQ-VER-003]
status: pending
evidence:
  commits: []
---

## Objetivo

Camada provenance, com REQ-VER-003 reescrito.

## Escopo

Distinguir change dirigida por card, que exige `explore/manifest.json`, de change escrita à mão, que não exige. Reabilitar `provenance` em `verify.levels`.

## Restrições

- Como REQ-VER-003 está escrito hoje, ele reprovaria qualquer change sem bundle, inclusive esta e a Fatia 2
- Depende do transporte MCP estar decidido: reescrever agora seria decidir duas vezes
