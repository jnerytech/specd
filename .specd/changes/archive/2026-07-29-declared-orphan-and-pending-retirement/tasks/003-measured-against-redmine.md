---
id: "003-measured-against-redmine"
change: 2026-07-29-declared-orphan-and-pending-retirement
req: [REQ-SYNC-014, REQ-SYNC-015, REQ-SYNC-016]
status: done
evidence:
  commits: ["38a108a"]
---

## Objetivo

Provar os dois caminhos novos contra o Redmine semeado, não contra um duplo.

## Escopo

`test/integration/redmine/orphans.test.ts` ganha os casos que faltam. Duplo concordaria com o que o adaptador acredita, que é justamente a crença sob teste — e foi assim que o 204 silencioso da change `board-sync-redmine` apareceu.

## Restrições

- O caso do rename de requisito realizado é medido no ciclo inteiro: `sync`, `archive`, `sync` de novo
- O caso da morte proposta é medido com change aberta em disco, e afirma no board que o card continua **aberto**
- Toda afirmação de que nada aconteceu é lida do servidor, não deduzida do relatório — absence-is-not-compliance na direção da escrita
- `npm run test:integration` continua fora de `npm run verify`

## Critérios de aceite

- Um caso cria o card, arquiva um delta com `REMOVED: REQ-A` mais `ADDED: REQ-B` de mesmo corpo, roda `sync` e confirma exit 2, card aberto, e nenhum card novo criado
- Um caso abre uma change com `REMOVED: REQ-A`, roda `sync`, e confirma execução completa, card aberto, ligação intacta e contagem de pendente igual a 1
- O mesmo caso arquiva em seguida e confirma `is_closed: true` lido do Redmine
- Um caso confirma que um item sadio da mesma execução não teve o `updated_on` movido quando houve recusa
- Um caso renomeia editando uma palavra do statement e confirma no Redmine que o card **fecha** — o limite declarado em REQ-SYNC-014, medido em vez de suposto
