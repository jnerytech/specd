---
id: "002-pending-retirement"
change: 2026-07-fatia-8
req: [REQ-SYNC-016]
status: done
evidence:
  commits: ["38a108a"]
---

## Objetivo

Destravar `sync` durante uma change de remoção aberta, sem fechar nada e sem silenciar nada.

## Escopo

`buildSpecTree` já chama `readOpenChanges` para montar as tasks e ignora `delta.removed`. Passa a devolver também os identificadores propostos para remoção, por capability, ao lado de `retired`. `findOrphanedLinks` ganha o terceiro estado, e `sync` o traduz num resultado próprio no relatório e na contagem.

A classificação final, e a ordem importa:

| órfã | ação |
| --- | --- |
| corpo bate em item planejado sem ligação | recusa, nomeia os dois |
| identificador sob REMOVED de change aberta | deixa em paz, relata |
| identificador em `retired` | fecha |
| nada corresponde | recusa |

## Restrições

- Proposto não fecha: change abandonada teria fechado card de morte que nunca aconteceu
- Proposto não recusa: recusar é o que trava `sync` durante a change inteira
- Proposto não some do relatório: verificar, encontrar e não contar é P8 pela definição
- Sem consulta ao board para descobrir isso — o sinal está no disco
- `effectiveSpecs` não muda; a remoção continua saindo da spec efetiva ao abrir a change

## Critérios de aceite

- Com change de remoção aberta e card já existente, `sync` completa e reporta o item como pendente de aposentadoria
- O card continua aberto e a ligação continua no frontmatter
- A contagem aparece em `formatSyncReport` e em `--json`
- Depois do `archive`, o mesmo identificador fecha por REQ-SYNC-014
- Identificador sob REMOVED cujo corpo reaparece em item sem ligação continua recusando, porque corpo vence
