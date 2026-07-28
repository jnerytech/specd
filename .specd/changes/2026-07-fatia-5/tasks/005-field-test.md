---
id: "005-field-test"
change: 2026-07-fatia-5
req: [REQ-HOOK-005, REQ-HOOK-006]
status: pending
evidence:
  commits: []
---

## Objetivo

Provar fora do processo que o bloqueio bloqueia.

## Escopo

Instalar o hook neste repositório, quebrar uma âncora, observar o comportamento do host. Registrar em `sandbox/runs/003-fatia-5.md` e atualizar o índice.

## Restrições

- Registrar a versão exata do Claude Code
- Registrar o payload enviado e qual canal o host consumiu
- O arquivo do run é imutável depois de escrito
- Restaurar a âncora e desinstalar o hook ao fim, se o teste exigir alteração no repositório
