---
id: "002-archive-sync"
change: 2026-07-fatia-7
req: [REQ-ARC-011, REQ-ARC-012, REQ-ARC-013]
status: pending
evidence:
  commits: []
---

## Objetivo

Fechar o laço: arquivar e publicar no mesmo ato deliberado, sem nenhum ato virar automático.

## Escopo

`archive` ganha `--sync`. Sem a flag, conta quantos itens arquivados estão sem ligação ou com ligação velha e reporta, sem tocar a rede. Com a flag, chama a reconciliação depois de as capabilities estarem escritas. `ArchiveSyncError` cobre a falha posterior à escrita.

## Restrições

- Ordem fixa: capabilities escritas primeiro, board depois
- Falha do board não desfaz nada e sai 2, dizendo que a spec avançou e o board não
- Sem `--sync` nenhuma requisição é feita, e a contagem sai das ligações gravadas
- Board não configurado com `--sync` sai 2 **antes** de aplicar o delta
- Não existe `--no-sync`
- Contagem zero é dita, não omitida
