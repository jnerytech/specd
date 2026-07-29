---
id: "002-render"
change: 2026-07-29-read-aloud
req: [REQ-READ-004]
status: done
evidence:
  commits: ["1e768d65ed20731b623c33b9367f25ac2b749393"]
---

## Objetivo

Tirar do Markdown tudo que não é prosa, deixando marca de cada corte.

## Escopo

`src/read/render.ts` com `renderForReading(markdown, { full })`. Frontmatter sai
antes do parse. Bloco de código sai por renderer customizado do `marked`:
`yaml anchors` vira um marcador próprio, fenced code genérico vira outro
nomeando a linguagem quando ela existe. Tabela vira `<ul>`, um `<li>` por linha,
cada célula prefixada pelo cabeçalho da coluna.

Entra a dep `marked`. É a única desta change.

## Restrições

- O marcador é curto e dito em prosa: quem ouve tem que entender que algo foi
  tirado sem que a marca vire ruído maior que o corte
- `--full` desliga tudo e cai no render GFM padrão, incluindo frontmatter
- Nenhuma resolução de âncora, nenhuma leitura do repositório: esta função vê
  string e devolve string
- Teste cobre um requisito real de `.specd/specs/`, não só fixture sintética —
  o bloco `yaml anchors` a cortar é exatamente o que este repositório escreve
