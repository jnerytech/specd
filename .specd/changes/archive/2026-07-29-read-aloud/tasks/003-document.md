---
id: "003-document"
change: 2026-07-29-read-aloud
req: [REQ-READ-003]
status: done
evidence:
  commits: ["1e768d65ed20731b623c33b9367f25ac2b749393"]
---

## Objetivo

Um HTML, do primeiro arquivo ao último, com sumário para saltar.

## Escopo

`src/read/document.ts` com `buildDocument(files, { full })`: lê cada arquivo,
passa por `renderForReading`, e concatena sob um `<h1>` com o caminho relativo e
um `id` estável para o sumário. Cabeçalho do documento traz contagem de arquivos
e de palavras. CSS inline, largura de leitura confortável, nada de JavaScript.

## Restrições

- Determinismo é testável e testado: mesmo conjunto, HTML idêntico byte a byte
- Contagem de palavras é do texto renderizado, depois dos cortes — contar o que
  foi omitido daria um número que não corresponde ao que se vai ouvir
- Sem JavaScript: leitor de TTS opera sobre o DOM entregue, e página que monta
  conteúdo depois é página que ele lê pela metade
- Marcação semântica — `h1`/`h2`/`p`/`ul` — porque é dela que o modo leitura do
  navegador deriva a estrutura
- Arquivo ilegível no meio do conjunto para o comando nomeando o arquivo; não
  se serve documento com buraco silencioso
