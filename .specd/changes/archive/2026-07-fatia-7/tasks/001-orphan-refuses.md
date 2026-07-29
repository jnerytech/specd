---
id: "001-orphan-refuses"
change: 2026-07-fatia-7
req: [REQ-SYNC-014, REQ-SYNC-015]
status: done
evidence:
  commits: ["079312f9d3acb19c3e1cb8d052bc45134835376f"]
---

## Objetivo

Parar de fechar card sem ter sido mandado. Fecha o que `retired` declara morto; recusa o resto.

## Escopo

`findOrphanedLinks` passa a receber os `retired` das capabilities e a separar órfã declarada de órfã não declarada. `src/sync/errors.ts` ganha `UndeclaredOrphanError`, que nomeia identificador, `ref`, URL e candidatos a rename. A detecção de candidato compara a projeção do item planejado contra a do snapshot do card órfão — o mesmo `synced_hash` que já decide o resto.

## Restrições

- Vem antes da task 002: sem isto, `archive --sync` amplifica o fechamento silencioso
- Projeção idêntica informa e não decide; vários candidatos listam todos
- A mensagem diz as duas saídas — trocar a chave da ligação ou declarar em `retired`
- Recusa não escreve nada, nem para os itens sadios da mesma execução
- `retired` é lido do arquivo de capability, não de configuração
