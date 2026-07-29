---
id: "005-skills-packaging"
change: 2026-07-29-cycle-skills
req: [REQ-SKL-001, REQ-SKL-002, REQ-SKL-003]
status: pending
evidence:
  commits: []
---

## Objetivo

Fazer as skills viajarem no pacote e chegarem ao repositório do cliente sem
sobrescrever trabalho de ninguém.

## Escopo

Fonte em `skills/`, um diretório por skill, cada um com `SKILL.md`. `files` do
`package.json` passa a incluir a árvore.

`src/init/skills.ts` com `SKILL_MANIFEST` — nome, caminho de origem, caminho de
destino e versão mínima de cada skill — e `installSkills`, acionada por
`specd init --skills`. Compara conteúdo antes de escrever: idêntico é
reportado como inalterado, diferente exige `--force`.

Cada `SKILL.md` declara `requires_specd` na frontmatter, e seu primeiro passo
lê `specd --version` e para se for menor.

## Restrições

- Este repositório consome as skills pelo mesmo caminho do cliente:
  `specd init --skills` escreve em `.claude/skills/`. Manter cópia editada à
  mão em `.claude/skills/` recria a divergência que o comando existe para tirar
- O tarball continua sem `.env`, `.specd/`, `sandbox/` e `test/`. Publicação já
  cobrou esse preço uma vez
- Nenhuma skill referencia caminho fora do pacote
- Skill não é código: nada em `dist/` importa `skills/`

## Critérios

Os de REQ-SKL-001, REQ-SKL-002 e REQ-SKL-003. O de empacotamento é teste sobre
`npm pack --dry-run --json`, na linha do que `test/distribution/` já faz.
