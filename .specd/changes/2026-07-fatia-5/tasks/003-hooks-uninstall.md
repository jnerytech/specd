---
id: "003-hooks-uninstall"
change: 2026-07-fatia-5
req: [REQ-HOOK-004]
status: done
evidence:
  commits: ["f317113142e82f2acdbc3e1ed213cc1e253d437a"]
---

## Objetivo

`specd hooks uninstall` remove só o que o specd escreveu.

## Escopo

`src/hooks/uninstall.ts`, reusando o leitor e o reconhecedor de entrada da task 002.

## Restrições

- Reconhecimento pelo comando conter `specd hooks run`
- Contêiner esvaziado pela remoção é removido; contêiner já vazio antes é preservado
- Nada a remover sai 0 dizendo isso
