---
id: "001-spec-command"
change: 2026-07-29-cycle-skills
req: [REQ-EFF-001, REQ-EFF-002, REQ-EFF-003]
status: pending
evidence:
  commits: []
---

## Objetivo

Dar saída à spec efetiva, que hoje só existe dentro do processo.

## Escopo

`src/spec/index.ts` com `specReport(root, options)` chamando `effectiveSpecs` —
a mesma função que `verify`, `status`, `sync` e `anchor fix` já usam. Nenhuma
segunda travessia de arquivo, nenhuma segunda regra de overlay.

`SpecRecord` carrega o requisito inteiro — id, capability, statement,
acceptance, âncoras — mais `origin` e `source`. `origin: delta` carrega o nome
da change.

Registro do comando em `src/cli/index.ts` e no `SCOPE_USAGE` de
`src/cli/usage.ts`, com `--json` e `--help`, por REQ-CLI-009 e REQ-CLI-010.

## Restrições

- `effectiveSpecs` é a fonte; reimplementar a aplicação do overlay cria o
  segundo lugar onde ela pode divergir
- Saída de texto e `--json` carregam a mesma informação. Uma delas mais pobre
  vira motivo para a skill escolher a outra e reparsear
- Exit 0 sempre que conseguir ler, 2 quando não conseguir. Nunca 1
- Nenhuma importação alcançável daqui toca rede

## Critérios

Os de REQ-EFF-001, REQ-EFF-002 e REQ-EFF-003, cada um como teste. O de exit
contract é anchor de REQ-EFF-003 e precisa existir com esse nome em
`test/spec/exit-contract.test.ts`.
