---
id: "001-hook-protocol"
change: 2026-07-fatia-5
req: [REQ-HOOK-005, REQ-HOOK-006]
status: done
evidence:
  commits: ["f317113142e82f2acdbc3e1ed213cc1e253d437a"]
---

## Objetivo

O adaptador: `specd hooks run <event>` traduz o veredito do gate para o protocolo do host.

## Escopo

`src/hooks/protocol.ts` define `HOOK_EXIT` — a convenção do host, separada do `EXIT` do specd. `src/hooks/run.ts` roda `verify` em processo e devolve `HookOutcome`. Teste de arquitetura sobre o grafo de importação a partir de `run.ts`.

## Restrições

- Bloqueio é o exit code; o JSON no stdout enriquece e não decide
- Mensagem legível no stderr, que é o canal devolvido ao agente
- Três resultados, e só "verificou e passou" libera
- Nenhum módulo alcançável a partir de `run.ts` importa `cli/exit-codes`
