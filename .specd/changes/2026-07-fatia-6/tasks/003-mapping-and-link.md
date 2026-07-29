---
id: "003-mapping-and-link"
change: 2026-07-fatia-6
req: [REQ-SYNC-006, REQ-SYNC-007]
status: done
evidence:
  commits: ["0ceef9745d9615396898742426aa72444993e146"]
---

## Objetivo

De que forma a spec vira board, e onde fica registrado que virou.

## Escopo

`src/sync/mapping.ts` resolve nível para tipo de item e aplica a regra de colapso. `src/sync/link.ts` lê e escreve o bloco `board:` no frontmatter da capability.

## Restrições

- Nível sem mapeamento e sem colapso sai 2 nomeando o nível
- Nível colapsado entra no ancestral mapeado mais próximo, não some
- O corpo do arquivo de capability fica byte-idêntico
- Comentários e ordem das chaves do frontmatter são preservados
