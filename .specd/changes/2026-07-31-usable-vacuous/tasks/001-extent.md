---
id: "001-extent"
change: 2026-07-31-usable-vacuous
req: [REQ-EXP-012]
status: pending
evidence:
  commits: []
---

## Objetivo

Dar ao manifest a pergunta que ele não tinha.

## Escopo

`src/explore/manifest.ts` ganha `CollectionExtent` e o campo no `ExploreManifest`.
`src/explore/index.ts` ganha `collectionExtent(sources)` e passa a preenchê-lo.
`formatManifest` em `src/cli/index.ts` nomeia o estado ao lado de `usable`.

## Restrições

- `usable` não muda de significado: a camada `provenance` o lê por REQ-VER-003, e
  trocar o sentido dele seria migração silenciosa
- `none` cobre "nenhuma declarada" e "todas falharam"; a lista de fontes do
  manifest é o que distingue os dois
- O manifest tem `version`; o campo novo entra sem quebrar quem lê o antigo

## Critérios

Os de REQ-EXP-012, cada um como teste.
