# Exploração — sync-unborn-capability

## Origem do escopo

Sem board neste repositório: `.specd/config.toml` não tem seção `[board]`. O
escopo veio do achado 1 da run 012 e da decisão do autor em 2026-07-30: saída C,
a recusa; escopo fechado na recusa.

## Escopo

Recusar o `sync` antes da primeira escrita quando a capability de um item
planejado não existe em disco.

## Não-escopo

- Migrar o bloco `board:` do delta para a capability (saída A, segue aberta)
- Criar arquivo de capability vazio no propose (saída B, descartada por violar
  Modelo B na letra)
- Qualquer mudança em `archive`, em `readBoardLinks` ou em `writeBoardLinks`
- Achado 3, que vive em `explore` e é independente

## Mapa do código, com símbolos conferidos

- `src/sync/index.ts` :: `export async function sync` — a ordem é: `buildSpecTree`,
  `planBoardItems`, `readLinksByCapability`, `readStates`, órfãs, conflitos,
  relatório, `if (options.dryRun) return report`, e só então `applyActions`.
- `src/sync/index.ts:536-540`, dentro de `applyActions` — depois de criar os
  cards, itera as capabilities tocadas e faz `readFileSync(capabilityFile(...))`.
  É aqui que estoura ENOENT.
- `src/sync/index.ts` :: `capabilityFile` — `join(root, ".specd", "specs", capability + ".md")`.
- `src/sync/index.ts` :: `readLinksByCapability` já pula capability sem arquivo
  com `if (!existsSync(file)) continue`. A leitura tolera a ausência; a escrita
  não. A assimetria entre as duas é o defeito inteiro.
- `assertNoUnsanctionedOrphans` e `assertNoConflicts` são o precedente de forma:
  asserções que param a corrida antes de qualquer escrita, cada uma citada por um
  requisito.

## Requisitos existentes que tocam a área

Conferidos em `specd spec --json`, todos `origin: specs`:

- REQ-SYNC-007 — a ligação vive na frontmatter da capability. É o requisito que
  cria a dependência do arquivo existir.
- REQ-SYNC-005 — conflito é levantado antes da primeira escrita e nada é
  escrito, nem os itens que estariam bem. Mesma forma que esta recusa precisa ter.
- REQ-SYNC-012 — rodar duas vezes não muda nada. Hoje isso é falso para este
  caminho: a segunda corrida recria os cards.
- REQ-FMT-001 — a capability é um arquivo sob `.specd/specs/`. É o que torna
  "capability sem arquivo" um estado nomeável.

## Lacunas e riscos

- A recusa tem que valer no `--dry-run`. O plano é o que a skill mostra ao autor
  antes de confirmar; um plano que omite o impedimento produz a confirmação de
  algo que não vai acontecer.
- Colocar a asserção cedo demais no fluxo é barato — ela não precisa de rede — e
  colocá-la tarde repete o defeito em menor escala.
- O caso normal precisa continuar passando: requisito de delta cuja capability
  já existe em `.specd/specs/` sincroniza hoje e tem que seguir sincronizando.

## Perguntas em aberto

Nenhuma. As três saídas foram apresentadas e o autor escolheu C, com o escopo
fechado na recusa.
