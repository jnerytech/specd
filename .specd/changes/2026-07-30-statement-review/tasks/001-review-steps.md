---
id: "001-review-steps"
change: 2026-07-30-statement-review
req: [REQ-SKL-007, REQ-SKL-008]
status: done
evidence:
  commits:
    - "8a41a38c046f20746b712bb45ecd5a8f5fa92cf7"
    - "e1c25a19cf7183e10daed34813455627782330ec"
    - "fae7e170294dde46d1a66f53c8a9e3d4e9d4da0a"
---

## Objetivo

Escrever as duas revisões nas skills, com o alcance de cada uma.

## Escopo

`skills/specd-propose/SKILL.md` ganha a revisão intrínseca no passo que escreve o
delta: um assunto por statement, quantificação dentro do alcance das âncoras,
todo critério com teste possível.

`skills/specd-archive-change/SKILL.md` ganha a revisão do diff nas pré-condições:
uma pergunta só, sobre requisito que mudou de texto ou de resolução de âncora
desde o propose.

`test/skills/content.test.ts` ganha os testes de conteúdo dos dois requisitos.

## Restrições

- Nenhuma verificação de enunciado no CLI
- Os quatro enunciados fracos não são consertados aqui, mesmo com o arquivo
  aberto. Eles são o conjunto de avaliação
- A skill aponta e pergunta; nunca reescreve enunciado nem âncora sozinha
- A revisão do archive não relê o delta inteiro

## Critérios

Os de REQ-SKL-007 e REQ-SKL-008, verificados sobre o texto de cada `SKILL.md`.
