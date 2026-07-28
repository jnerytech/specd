---
id: 004-ears-parser
change: 2026-07-fatia-1
req: [REQ-EARS-001, REQ-EARS-002, REQ-EARS-003, REQ-EARS-004, REQ-EARS-005]
status: done
evidence:
  commits: [c5b18943420e137a80c1c9342524b3b426f8f006]
---

## Objetivo

Validar statements contra os cinco padrões EARS, com keywords em inglês e prosa em qualquer idioma.

## Escopo

Gramática dos cinco padrões, detecção de SHALL múltiplo ou ausente, identificação do padrão casado.

## Restrições

- Keyword traduzida é rejeitada com mensagem explicativa
- Dois SHALL no mesmo statement reprovam sugerindo divisão
- O padrão identificado é anexado ao modelo do requisito

## Done when

- Todos os statements deste repositório passam
- Teste cobre os cinco padrões com prosa em português
- Teste cobre SHALL duplo, SHALL ausente e keyword traduzida
