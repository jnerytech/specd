---
id: "006-evidence"
change: 2026-07-fatia-2
req: [REQ-VER-005, REQ-VER-010, REQ-VER-011]
status: done
evidence:
  commits: ["2b946a9d5ecac77814c81b037ded658d31404909"]
---

## Objetivo

Camada evidence em três desfechos

## Escopo

Commits vazio com status `done` reprova; SHA inalcançável avisa; histórico ausente sai 2.

## Restrições

- Sobrevive a squash, rebase e clone raso
- A propriedade antifraude que importa — alegação sem lastro nenhum — continua reprovando
- "Não consegui verificar" nunca é renderizado como "verifiquei e reprovou"
