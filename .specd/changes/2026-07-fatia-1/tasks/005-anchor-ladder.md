---
id: 005-anchor-ladder
change: 2026-07-fatia-1
req: [REQ-ANC-002, REQ-ANC-003, REQ-ANC-004, REQ-ANC-005]
status: done
evidence:
  commits: []
---

## Objetivo

Escada de resolução em cinco passos, determinística, com busca de fallback no repositório.

## Escopo

Resolver âncora, estratégia grep, seleção por extensão, busca no repositório respeitando `.gitignore`.

## Restrições

- Primeiro match vence; ordem dos passos é fixa
- Um match no fallback vira sugestão; zero ou vários viram pendurada pura
- Treesitter solicitado produz erro de configuração, não fallback silencioso

## Done when

- Teste cobre cada um dos cinco passos isoladamente
- Teste prova determinismo: mesma entrada, mesma saída em execuções repetidas
- Nenhuma dependência de gramática WASM no bundle
