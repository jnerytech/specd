---
change: 2026-07-fatia-3
target: [verify]
---

# Delta — Fatia 3

Escopo mínimo aberto para dar casa a um requisito que nenhuma outra change
implementa. Ver `proposal.md` para por que a change existe antes de ter data.

## ADDED

### REQ-VER-003 — Provenance layer

**Capability.** verify

**Statement.** WHEN a change directory exists, the specd verifier SHALL reject it if `explore/manifest.json` is absent or if any source marked required has a status other than `ok`.

**Acceptance.**
- Manifest ausente reprova
- Fonte required com status `failed` reprova e é nomeada no erro
- Fonte opcional falhada não reprova

O statement acima está aqui como estava em `.specd/specs/`, sem correção. A
correção é o trabalho da Fatia 3: como escrito, ele reprova qualquer change sem
bundle de `explore`, inclusive change escrita à mão, que é o caso da Fatia 2 e
desta própria. Reescrevê-lo agora sem o transporte MCP resolvido seria decidir
duas vezes.

```yaml anchors
- file: src/verify/layers/provenance.ts
  symbol: "export const provenanceLayer"
```

## MODIFIED

Nenhum.

## REMOVED

Nenhum.
