---
id: "004-word-boundary"
change: 2026-07-fatia-4
req: [REQ-ANC-010]
status: pending
evidence:
  commits: []
---

## Objetivo

Match é identificador, não substring

## Escopo

`indexOfSymbol` exige delimitador nos lados em que o próprio símbolo termina em caractere de identificador.

## Restrições

- `TenantAccessor` para de casar `TenantAccessorRegisterMiddleware`
- Fronteira só é exigida no lado que pode colidir: âncora como `"bin"` já termina em pontuação
- Vale igual no passo 3 e na busca do passo 5
