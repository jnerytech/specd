---
id: "002-hooks-install"
change: 2026-07-fatia-5
req: [REQ-HOOK-001, REQ-HOOK-002, REQ-HOOK-003, REQ-HOOK-007]
status: pending
evidence:
  commits: []
---

## Objetivo

`specd hooks install` escreve as duas entradas em `.claude/settings.json` sem estragar o que já está lá.

## Escopo

`src/hooks/settings.ts` lê e valida a forma esperada; `src/hooks/install.ts` monta o comando e faz o merge. Flags `--full-on-stop`, `--force`, `--command`.

## Restrições

- Entrada de terceiro preservada byte a byte
- Idêntica é no-op; divergente aborta com os dois comandos; `--force` substitui
- JSON ilegível sai 2 sem escrever, e `--force` não contorna
- `--fast` nos dois eventos por default; a escolha fica no settings.json
- Escreve e não staged
