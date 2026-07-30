# Exploração — statement-review

## Origem do escopo

Sem board neste repositório. O escopo veio da decisão do autor em 2026-07-30:
revisão de enunciado nas duas skills, com pesos diferentes, e escopo do archive
fechado no que mudou desde o propose.

## Escopo

Fazer a revisão de enunciado existir em `specd-propose` e em
`specd-archive-change`, e declará-la como requisito da capability `skills`.

## Não-escopo

- Consertar REQ-EFF-003, REQ-SKL-001, REQ-SKL-003 e a família que quantifica
  sobre quatro ancorando em um — todos em `origin: specs`, change própria
- Qualquer verificação de enunciado no CLI
- Mudança no `verify` ou em qualquer camada

## Mapa do código, com símbolos conferidos

- `skills/specd-propose/SKILL.md` — passo 3 escreve o delta e já lista as regras
  que o gate cobra; é onde a revisão intrínseca encaixa. Passo "Quando parar e
  perguntar" já existe e é onde a dúvida vira pergunta.
- `skills/specd-archive-change/SKILL.md` — "1. Pré-condições duras" roda o gate;
  é onde a revisão do diff encaixa, antes de anunciar a escrita.
- `test/skills/content.test.ts` — verifica o texto das skills por grep, com
  `packagedSkillsPath()` de `src/init/skills.ts`. É onde os critérios novos viram
  teste.
- `src/init/skills.ts` :: `SKILL_MANIFEST` — lista as quatro skills; não muda.

## Requisitos existentes que tocam a área

Conferidos em `specd spec --json`, todos `origin: specs`:

- REQ-SKL-005 — decisão que a skill não consegue tomar vai ao autor pela
  ferramenta de pergunta do host. A revisão nova se apoia nele: o que a revisão
  não decide, ela pergunta.
- REQ-SKL-004 — a skill lê a spec pelo CLI. Não muda.
- REQ-FMT-005 e REQ-FMT-006 — o delta declara três seções e ADDED/MODIFIED
  carregam texto completo. É o material que a revisão lê.
- REQ-ANC-001 — âncora é `file` obrigatório e `symbol` opcional. Define o que
  "alcance da âncora" pode significar.

## Os quatro fracos como conjunto de avaliação

São os únicos statements conhecidamente ruins do repositório, com diagnóstico
escrito, em quatro formas distintas. Servem para responder se os critérios pegam
alguma coisa antes de o delta fechar. Não são consertados aqui.

## Lacunas e riscos

- "O que mudou desde o propose" precisa incluir âncora que passou de pendurada a
  resolvida. Se for lido só como diferença de texto, REQ-SKL-003 escapa: a
  declaração dele nunca mudou, o que mudou foi o símbolo passar a existir. Essa
  leitura vai escrita no requisito, porque a leitura estreita torna a segunda
  janela quase vazia.
- Revisão que relê o delta inteiro no archive é revisão que alguém pula. O
  estreitamento é o que a mantém viva.
- Nenhum critério pode exigir que a skill decida sozinha o que é "bom
  enunciado": o que ela faz é aplicar teste mecânico e perguntar no resto.

## Perguntas em aberto

Nenhuma. A divisão e os pesos foram decididos antes desta exploração.
