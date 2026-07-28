---
id: 007-architecture-tests
change: 2026-07-fatia-1
req: [REQ-CLI-002, REQ-CLI-005]
status: done
evidence:
  commits: [91c1ba01f5ff8320182ecde92b9c100bbb4c834e]
---

## Objetivo

Impedir mecanicamente que o verify ganhe dependência de LLM ou de rede.

## Contexto

P1 e P3 são os princípios que sustentam o determinismo do produto inteiro. Violá-los é fácil por descuido e caro de descobrir tarde.

## Escopo

Testes que percorrem o grafo de importação a partir de `src/verify/index.ts` e falham se alcançarem módulo de LLM ou de rede.

## Restrições

- O teste roda no CI e é bloqueante
- A lista de módulos proibidos é explícita e comentada

## Done when

- Introduzir um import de rede em qualquer módulo do verify quebra o CI
- Teste roda em menos de dois segundos
