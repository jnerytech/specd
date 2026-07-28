---
change: 2026-07-fatia-2
status: active
---

# Fatia 2 — fechar o ciclo change → verify → archive

## Por quê

A Fatia 1 entregou o gate e não entregou como fechar uma change. O resultado é
que o próprio repositório não consegue arquivar o trabalho que terminou, e a
spec acumula requisitos que nenhuma change reivindica.

Esta fatia fecha o ciclo. O critério de sucesso é auto-aplicação: `specd archive`
arquiva a Fatia 1, depois arquiva a Fatia 2, e `specd verify` fica verde sem
warning.

## Escopo

Entram: `readOpenChanges` com exclusão de `archive/`, passagem vazia tratada como
falha operacional, `parseDelta`, `parseTask`, camadas `coverage` e `evidence`,
comando `archive`, comando `anchor fix`, e o relatório de localização e de idade
de change aberta no `status`.

Ficam fora: `propose`, `apply`, `sync`, memória, hooks, camada `provenance` e
transporte MCP.

## Ordem

```
readOpenChanges + exclusão de archive/ + passagem vazia
        │
        ├── parseDelta ──┬── coverage
        │                └── archive
        └── parseTask  ──┴── evidence
                            anchor fix   (independente, cauda opcional)
                            status       (depende de todos)
```

Os três primeiros vêm antes porque `coverage`, `evidence` e `archive` precisam
saber de qual change estão falando, e hoje `readActiveChange` devolve a mais
antiga por ordenação ascendente.

## Modelo B

Este delta é a superfície de escrita. O texto completo dos requisitos mora aqui
até que `archive` os aplique em `.specd/specs/`, que passa a conter só verdade
realizada.

A política de âncora deixa de consultar "a change ativa" e passa a graduar por
origem: requisito vindo de `.specd/specs/` é realizado, logo âncora pendurada é
erro; requisito vindo de delta de change aberta é trabalho em voo, logo é
warning. Nenhum consumidor precisa mais escolher uma única change ativa, e
changes abertas concorrentes viram estado legítimo.

## Provenance e MCP ficam de fora, e por quê

`REQ-VER-003` reprova qualquer change cujo diretório não tenha
`explore/manifest.json`. A Fatia 2 não é dirigida por card e não tem bundle:
ligar `provenance` aqui reprovaria esta própria fatia. O requisito espera a
Fatia 3, junto com o transporte MCP, e mora no delta de lá.

## Auto-aplicação

O alvo fácil vem antes do difícil e prova a mesma coisa:

1. `specd archive 2026-07-fatia-1` sai 0. Os requisitos afetados da Fatia 1 têm
   âncora resolvendo.
2. Fatia 2 implementada. Gate verde com os warnings desta change.
3. `specd archive 2026-07-fatia-2` sai 0.
4. `specd verify` verde, sem warning, com a Fatia 3 ainda aberta.

O passo 4 é o critério real: pela primeira vez o repositório fica sem âncora
pendurada em `.specd/specs/`.

## Saída do OpenSpec

Esta é a última change rastreada nos dois sistemas. A partir do passo 3, abrir
change em `openspec/changes/` é regressão. O rastreio duplo existiu enquanto uma
change do `.specd` não podia ser fechada.
