---
id: "003-degraded-report"
change: 2026-07-fatia-4
req: [REQ-VER-012]
status: done
evidence:
  commits: ["86c964643e7a6a4b995a7c5a25e902cdfbae70a3"]
---

## Objetivo

Relatar capacidade degradada

## Escopo

A camada anchors registra modo e contagem de arquivos, e avisa quando enxerga zero.

## Restrições

- P8 direto: verde não pode significar duas coisas diferentes
- "Toda âncora resolve" e "toda âncora resolve e eu saberia onde procurar" são estados distintos
