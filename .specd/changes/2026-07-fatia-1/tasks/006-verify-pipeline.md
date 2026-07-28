---
id: 006-verify-pipeline
change: 2026-07-fatia-1
req: [REQ-VER-001, REQ-VER-002, REQ-VER-006, REQ-VER-007, REQ-VER-008, REQ-CLI-001, REQ-CLI-004]
status: done
evidence:
  commits: []
---

## Objetivo

Pipeline de camadas ordenadas com parada na primeira falha, camadas desligáveis, shell-out argv e relatório JSON.

## Escopo

Orquestração das camadas, camada schema, camada anchors, camada project, contrato de exit code, relatório.

## Restrições

- Ordem das camadas é fixa e não configurável; apenas quais rodam é configurável
- `validation_command` executa sem shell
- Exit 1 é reprovação de gate; exit 2 é falha operacional

## Done when

- `specd verify` roda sobre este repositório e reprova por âncora pendurada
- `--json` emite relatório completo com severidade por item
- `--fast` marca a camada project como pulada, não aprovada
