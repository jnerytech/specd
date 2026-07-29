---
id: "004-documented-formats"
change: 2026-07-fatia-7
req: [REQ-FMT-010, REQ-CLI-007]
status: pending
evidence:
  commits: []
---

## Objetivo

As duas paredes de documentação do run 006: como executar, e o formato de `changes/`.

## Escopo

README e AGENTS.md ganham a sequência de clone a comando funcionando. Documento de formato com exemplo completo de `delta.md` e de `tasks/*.md`. Testes que extraem os exemplos do documento e os passam por `parseDelta` e `parseTask`, e que amarram o caminho citado no README ao `bin` do `package.json`.

## Restrições

- O teste extrai do documento; cópia paralela dentro do teste anula o contrato
- `npx specd` continua documentado, com a ressalva de que ainda não está publicado
- Mudança de parser que invalide o exemplo publicado reprova o gate
- O que não é gatilhável fica declarado como prosa, no proposal, e não fingido de contrato
