---
id: "001-declared-orphan-with-reappearing-body"
change: 2026-07-29-declared-orphan-and-pending-retirement
req: [REQ-SYNC-014, REQ-SYNC-015]
status: done
evidence:
  commits: ["38a108a"]
---

## Objetivo

Fechar o caminho que a change `orphan-guard-and-documented-formats` isentou: órfã declarada em `retired` cujo corpo reaparece em item planejado sem ligação deixa de fechar e passa a recusar, nomeando os dois identificadores.

## Escopo

`assertNoUndeclaredOrphans` hoje filtra `!orphan.declared` e deixa a declarada passar sem consultar o `bodyKey`. A busca de candidato passa a rodar para toda órfã, e a decisão de fechar passa a exigir as duas condições: declarada **e** sem corpo reaparecendo. A mensagem já existe em `UndeclaredOrphanError` e ganha o caso declarado, dizendo as saídas que valem para ele.

## Restrições

- Corpo batendo vence declaração; essa precedência é o ponto da task
- Vem antes da 002 porque a 002 insere um estado no meio de uma classificação que precisa estar certa antes de crescer
- Candidato continua informando e não decidindo; vários candidatos listam todos
- A recusa continua global: nada é escrito, nem para os itens sadios da mesma execução
- Toda órfã passa a custar uma leitura do board, inclusive a declarada. Não dá para saber que ela é fechável sem ambiguidade sem ler o corpo do card: o requisito que morreu saiu da spec, então o corpo dele só existe no board. A regra "quem não precisa da rede não a exige" continua valendo e aqui a rede é necessária
- Card ausente do board — `read` devolvendo `undefined`, que no adaptador é só 404 — não tem corpo para reaparecer, então não gera candidato e a disposição segue a declaração, como hoje

## Critérios de aceite

- `REMOVED: REQ-A` mais `ADDED: REQ-B` com o mesmo corpo, depois do archive, sai 2 e nomeia os dois
- Órfã declarada sem corpo reaparecendo continua fechando e removendo a ligação
- Órfã não declarada continua saindo 2 com o comportamento da change `orphan-guard-and-documented-formats` intacto
- O teste que a change `orphan-guard-and-documented-formats` escreveu para morte declarada continua passando sem edição
