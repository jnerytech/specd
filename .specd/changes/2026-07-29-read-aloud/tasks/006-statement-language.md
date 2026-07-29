---
id: "006-statement-language"
change: 2026-07-29-read-aloud
req: [REQ-READ-007]
status: done
evidence:
  commits: ["1e768d65ed20731b623c33b9367f25ac2b749393"]
---

## Objetivo

Dizer ao leitor de tela que o statement é inglês, sem prometer que ele obedece.

## Escopo

`markStatementLanguage` em `src/read/render.ts`: no passe de tokens, parágrafo
cujo texto começa por `**Statement.**` sai como `<p lang="en">`. O documento
declara `lang="pt-BR"` na raiz, que `buildDocument` já escreve.

Vale nos dois modos. `--full` desliga omissão, não marcação — são coisas
diferentes e uma flag só não pode responder pelas duas.

## Restrições

- O reconhecimento é pelo marcador `**Statement.**` de REQ-FMT-006, nunca por
  heurística de idioma: detectar idioma é julgamento, e no-llm-in-decision-path
  o mantém fora daqui
- Nada além do parágrafo do statement é marcado
- Teste afirma o atributo no HTML, nunca a troca de voz — o comportamento do
  leitor de terceiro não é verificável aqui e não vira critério
- Sem atributo, o texto sai idêntico: a marcação não pode acrescentar nada
  audível
