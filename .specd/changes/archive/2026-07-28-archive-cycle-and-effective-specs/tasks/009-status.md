---
id: "009-status"
change: 2026-07-28-archive-cycle-and-effective-specs
req: [REQ-CFG-007, REQ-CFG-008, REQ-CFG-009]
status: done
evidence:
  commits: ["2b946a9d5ecac77814c81b037ded658d31404909"]
---

## Objetivo

Status localiza requisito e mede encalhe

## Escopo

Onde cada ID mora, há quanto tempo cada change está aberta, e quantos requisitos ela mantém pendurados.

## Restrições

- Sob o Modelo B o ID é estável e o endereço não
- Idade vem do histórico; indisponível reporta desconhecida, sem erro
- O comando continua saindo 0: informa, não julga
