---
change: 2026-07-fatia-3
status: active
---

# Fatia 3 — provenance e transporte de coletor

## Por quê esta change existe antes de ser trabalhada

Sob o Modelo B, `.specd/specs/` contém só verdade realizada. `REQ-VER-003`
descreve a camada `provenance`, que não existe em código e não entra na Fatia 2 —
como está escrito, ele reprova qualquer change sem `explore/manifest.json`, o que
inclui a própria Fatia 2.

Sem esta change o requisito não tem casa. Ficar em `specs/` sob Modelo B é erro
incondicional; entrar no delta da Fatia 2 impediria a Fatia 2 de arquivar, porque
REQ-ANC-007 exige âncora resolvendo; ser REMOVIDO aposentaria o identificador, e
REQ-FMT-004 proíbe reuso.

Esta change é a quarta saída: existe, segura o requisito, e não fecha até ser
trabalhada.

## Escopo previsto

- Reescrever REQ-VER-003, hoje amplo demais: distinguir change dirigida por card,
  que exige bundle, de change escrita à mão, que não exige
- Especificar o transporte do coletor MCP. REQ-EXP-002 declara o tipo `mcp` e não
  diz o transporte; a implementação da Fatia 1 cobre resposta JSON e marca a
  fonte como falha em SSE
- Reabilitar `provenance` em `verify.levels`

## Guarda contra encalhe

Esta change segura um órfão por tempo indeterminado, e change que segura órfão e
não fecha rebaixa a warning tudo que lista. REQ-CFG-008 e REQ-CFG-009, no delta
da Fatia 2, existem para tornar isso visível: `specd status` passa a reportar há
quanto tempo cada change está aberta e quantos requisitos ela mantém em warning.

Enquanto esta change existir com um requisito só, a dívida que ela esconde é de
exatamente um. Se crescer sem fechar, o relatório dirá.
