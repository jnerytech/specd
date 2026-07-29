---
id: "003-board-transition"
change: 2026-07-29-cycle-skills
req: [REQ-SYNC-017, REQ-ARC-014]
status: pending
evidence:
  commits: []
---

## Objetivo

Ensinar o adaptador a entregar o item, e o `archive` a usar isso só para a
change que está arquivando.

## Escopo

`BoardAdapter` em `src/sync/adapter.ts` ganha `transition(ref, status, notes)`.
`src/sync/adapters/redmine.ts` implementa: resolve o status pelo nome
configurado em `board.mapping.archived_status`, faz o PUT, relê a issue e falha
se o status não mudou. A resolução do nome reusa `statusCache`, que já existe
para `close`.

`src/archive/index.ts` ganha `transitionArchivedItems`, que roda depois da
reconciliação de conteúdo e transiciona apenas os itens ligados aos requisitos
da change arquivada.

## Restrições

- `close` continua existindo e continua sendo REQ-SYNC-014. Transição não é
  fechamento, e a mesma função servindo aos dois apaga a diferença
- Sem `archived_status` configurado nada é tentado, e a saída diz isso — o
  silêncio aqui seria lido como "transicionou"
- Falha da transição não desfaz o archive, por REQ-ARC-012
- Item de outra change aberta não é tocado. A ligação é por requisito, então o
  filtro sai dos requisitos do delta arquivado

## Critérios

Os de REQ-SYNC-017 e REQ-ARC-014. O caso do 204 que não aplica precisa de teste
com resposta forjada — é o modo de falha medido, não hipotético. A suíte de
integração cobre o caminho real contra o Redmine em container.
