---
id: "005-detect-stack"
change: 2026-07-fatia-4
req: [REQ-CFG-005]
status: pending
evidence:
  commits: []
---

## Objetivo

detect-stack .NET e Makefile

## Escopo

Reconhece `.sln`, `.csproj` e alvo de verificação no `Makefile`. Manifesto achado sem comando conhecido é nomeado.

## Restrições

- Makefile por último: manifesto de linguagem é resposta mais específica
- A mensagem não pode afirmar que não há manifesto quando há
