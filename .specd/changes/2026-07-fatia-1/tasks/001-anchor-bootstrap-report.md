---
id: 001-anchor-bootstrap-report
change: 2026-07-fatia-1
req: [REQ-ANC-001, REQ-ANC-003, REQ-CLI-003]
status: done
evidence:
  commits: [2ea3952e761d859ecd3e8c5059632dacd47f1eac]
---

## Objetivo

Resolver OPEN-012: dar às specs existentes um caminho para ganhar âncoras sem que a ferramenta as invente.

## Contexto

Sem âncoras, a camada que mais diferencia o specd não roda em nada. Escrever âncora à mão em spec grande é inviável; deixar o LLM inventar produz drift falso e destrói a confiança no gate logo no primeiro uso.

## Escopo

Comando `specd anchor suggest <capability>` que lê os requisitos, extrai termos candidatos do statement e dos critérios de aceite, busca no repositório e emite um relatório de candidatas com caminho, símbolo e grau de confiança.

## Restrições

- Não escreve no arquivo de capability em hipótese alguma
- Saída em texto legível e em JSON via `--json`
- Candidata com múltiplos matches é listada como ambígua, nunca escolhida

## Done when

- Rodar sobre uma capability sem âncoras produz relatório com ao menos uma candidata por requisito quando o símbolo existe
- Nenhum arquivo de spec é modificado
- Teste cobre o caso de zero, um e múltiplos matches
