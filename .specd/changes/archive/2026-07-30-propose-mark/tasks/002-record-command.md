---
id: "002-record-command"
change: 2026-07-30-propose-mark
req: [REQ-EFF-005]
status: done
evidence:
  commits:
    - "3ac3a58d60dfc8adf00907d60a4a54a6195341c0"
    - "e202995b604c5b921d479fc84e3bc30455e49d55"
---

## Objetivo

Fazer o registro ser calculado por comando, não transcrito por agente.

## Escopo

`src/spec/record.ts` com `proposeRecord(root, change)`: monta o registro dos
requisitos que a change declara, resolvendo cada âncora com `resolveAnchor` — o
mesmo resolvedor do gate, e não o relatório dele.

Comando `propose-record` em `src/cli/index.ts` e no `SCOPE_USAGE`, com `--change`
obrigatório.

## Restrições

- `resolved` sai do resolvedor, nunca de camada: o resultado não pode depender de
  `anchors` estar em `verify.levels`
- Requisito de outra change ou de `.specd/specs/` não entra
- Informa e nunca julga: exit 0 com âncora pendurada, 2 quando não consegue
  escrever ou quando a change não existe
- Nenhuma verificação de enunciado no comando
- A janela de escrita é imposta pelo comando: task fora de `pending` recusa. A
  regra estava só no texto da skill e foi furada na primeira oportunidade

## Critérios

Os de REQ-EFF-005, cada um como teste.
