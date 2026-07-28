---
id: "002-listing-fallback"
change: 2026-07-fatia-4
req: [REQ-ANC-009]
status: done
evidence:
  commits: ["86c964643e7a6a4b995a7c5a25e902cdfbae70a3"]
---

## Objetivo

Listagem com fallback

## Escopo

`listRepository` usa git só quando ele sucede E devolve ao menos um arquivo; caso contrário caminha o sistema de arquivos a partir da raiz.

## Restrições

- Git sucedendo com zero resultados é listador cego, não repositório vazio
- `.gitignore` continua respeitado quando o git enxerga algo
