---
id: "005-detect-stack"
change: 2026-07-28-project-root-and-file-visibility
req: [REQ-CFG-005]
status: done
evidence:
  commits: ["86c964643e7a6a4b995a7c5a25e902cdfbae70a3"]
---

## Objetivo

detect-stack .NET e Makefile

## Escopo

Reconhece `.sln`, `.csproj` e alvo de verificação no `Makefile`. Manifesto achado sem comando conhecido é nomeado.

## Restrições

- Makefile por último: manifesto de linguagem é resposta mais específica
- A mensagem não pode afirmar que não há manifesto quando há
