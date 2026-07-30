---
id: "001-refuse"
change: 2026-07-30-sync-unborn-capability
req: [REQ-SYNC-018]
status: done
evidence:
  commits:
    - "3d1c297104e3d7aa9740f9a2fcb31103ab686193"
    - "83e1b31844095124ce6cc2751c00d8b0fb3abb10"
---

## Objetivo

Recusar cedo, sem rede, e sem ter escrito nada.

## Escopo

`assertCapabilitiesExist` em `src/sync/index.ts`, chamada logo depois de
`planBoardItems` — antes de `readStates`, que já toca a rede, e muito antes de
`applyActions`. Recebe os itens planejados, a raiz e as changes abertas, para que
a mensagem consiga nomear qual delta declara a capability que falta.

## Restrições

- Escopo fechado na recusa. Não migrar bloco `board:`, não tocar em `archive`,
  não mexer em `readBoardLinks` nem em `writeBoardLinks`
- A asserção roda antes do `return` do `--dry-run`
- Nenhuma requisição de rede acontece para descobrir a ausência
- Se durante a implementação a saída A parecer que cabe junto, ela não cabe:
  registrar e seguir

## Critérios

Os de REQ-SYNC-018, cada um como teste. O teste do "nada foi criado" usa
adaptador falso que rejeita qualquer escrita, como `test/sync/orphans.test.ts`
já faz.
