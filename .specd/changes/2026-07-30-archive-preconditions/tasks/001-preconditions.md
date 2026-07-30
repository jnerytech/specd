---
id: "001-preconditions"
change: 2026-07-30-archive-preconditions
req: [REQ-ARC-002, REQ-ARC-015]
status: pending
evidence:
  commits: []
---

## Objetivo

Fazer o `archive` recusar o que o gate recusaria, sem herdar o que não é dele.

## Escopo

`assertArchivable` passa a montar sua lista a partir de `verify.levels`, na ordem
de `LAYER_ORDER`, tirando `project`. Reusa `IMPLEMENTED` de `src/verify/index.ts`
em vez de manter um segundo mapa.

`scopedDiagnostics` corta `effective.diagnostics` para os arquivos do diretório
da change e das capabilities que o delta reescreve, com caminhos normalizados
antes da comparação.

## Restrições

- A lista de camadas tem uma fonte só. Um segundo array com os mesmos nomes é o
  defeito que REQ-VER-001 já descreve no `verify`
- `project` nunca entra, mesmo configurada
- Nada é escrito quando aborta, por REQ-ARC-009 — a validação continua antes de
  qualquer escrita. O plano de aplicação passa a ser computado antes das
  pré-condições porque a retomada precisa dele; computar não é escrever
- Diagnóstico de `ADDED` que a retomada já aplicou é dispensado, por REQ-ARC-010
- A âncora de REQ-ARC-002 muda de `assertArchivable` para
  `export async function assertArchivable`; se o símbolo mudar de novo, a spec
  acompanha no mesmo commit

## Critérios

Os de REQ-ARC-002 e REQ-ARC-015, cada um como teste.
