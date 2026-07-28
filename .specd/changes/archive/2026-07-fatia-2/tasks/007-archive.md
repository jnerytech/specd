---
id: "007-archive"
change: 2026-07-fatia-2
req: [REQ-ANC-007, REQ-ARC-001, REQ-ARC-002, REQ-ARC-003, REQ-ARC-004, REQ-ARC-005, REQ-ARC-006, REQ-ARC-007, REQ-ARC-008, REQ-ARC-009, REQ-ARC-010]
status: done
evidence:
  commits: ["2b946a9d5ecac77814c81b037ded658d31404909"]
---

## Objetivo

Comando archive

## Escopo

Aplica ADDED, MODIFIED e REMOVED nas capabilities e move a change para `archive/`.

## Restrições

- Change nomeada por argumento explícito; inferir seria adivinhar
- Precondições reprovam com exit 2 sem escrever nada
- Toda escrita é calculada e validada antes de qualquer byte ir para o disco; o movimento do diretório é a última operação
- Nada é staged ou commitado
