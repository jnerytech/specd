---
id: "005-field-test"
change: 2026-07-28-hooks-enforce-the-gate
req: [REQ-HOOK-005, REQ-HOOK-006]
status: done
evidence:
  commits:
    [
      "f317113142e82f2acdbc3e1ed213cc1e253d437a",
      "9e4ddfd6ded8db09bdf38f1a40c6a9edeb03d986",
    ]
---

## Objetivo

Provar fora do processo que o bloqueio bloqueia.

## Escopo

Instalar o hook neste repositório, quebrar uma âncora, observar o comportamento do host. Registrar em `sandbox/runs/003-hooks-enforce-the-gate.md` e atualizar o índice.

## Restrições

- Registrar a versão exata do Claude Code
- Registrar o payload enviado e qual canal o host consumiu
- Registrar a versão exata do Claude Code
- Registrar o payload enviado e qual canal o host consumiu
- O arquivo do run é imutável depois de escrito
- Restaurar a âncora e desinstalar o hook ao fim, se o teste exigir alteração no repositório

## Resultado

Observado em 2026-07-28, Claude Code 2.1.220, em segunda sessão — a primeira não
serviu porque o host não recarrega `.claude/settings.json` criado depois da
abertura.

`findProjectRoot` renomeado em `src/core/root.ts`; `hooks run stop --fast`
confirmado em exit 2 à mão. **`Stop` bloqueou**: o host devolveu o controle ao
agente em vez de encerrar o turno. **`PostToolUse` também bloqueou**, no próprio
`Edit` que quebrou a âncora.

O canal que chegou ao agente foi o **texto do stderr**, sem o envelope
`{"decision":"block"}` — coerente com exit 2 devolver stderr e o stdout só ser
lido como JSON quando o código de saída é 0. Quem bloqueia é o exit code.
Âncora restaurada, gate verde. Detalhe em `sandbox/runs/003-hooks-enforce-the-gate.md` §3b (a
pasta `sandbox/` é ignorada pelo git, daí este resumo aqui).
