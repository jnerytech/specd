---
change: 2026-07-fatia-3
status: active
---

# Fatia 3 — provenance, transporte MCP e delta ilegível

## Por quê

A Fatia 2 fechou o ciclo e deixou três buracos, todos conhecidos e nenhum
acidental.

`REQ-VER-003` descrevia a camada `provenance` sem a condição de guarda: como
estava escrito, exigia `explore/manifest.json` de toda change, o que reprova
qualquer change que não tenha nascido de um card — inclusive as duas que
construíram esta ferramenta. A camada ficou desligada por isso, e camada
desligada é checagem que ninguém está fazendo.

`REQ-EXP-002` declara o tipo de fonte `mcp` e não diz o transporte. A
implementação da Fatia 1 lê o modo de resposta JSON e marca a fonte como falha
em SSE — comportamento correto, sem requisito que o sustente.

E o achado da própria Fatia 2: **delta ilegível passa por delta vazio.**
Arquivar a Fatia 1 saiu com código 0 tendo escrito zero arquivos, porque o
`delta.md` dela está no formato antigo e o parser novo lê zero blocos de
requisito nele. O resultado estava certo por acidente. Ausência de dados lida
como conformidade é a mesma família da passagem vazia, e é o modo de falha mais
perigoso que a fatia anterior expôs.

## Escopo

Entram: `REQ-VER-003` reescrito e implementado, `provenance` reativada no
config, `REQ-EXP-009` para o transporte MCP, `REQ-FMT-009` para o conteúdo
ilegível de delta, e `REQ-ANC-003` modificado para documentar a exclusão de
árvores que já existia sem requisito.

Ficam fora: `propose`, `apply`, `sync`, memória e hooks.

## Esta change é gerenciada só pelo specd

Primeira do produto sem rastreio paralelo em OpenSpec. O ciclo que a Fatia 2
entregou — escrever o delta, cobrir com tasks, implementar, arquivar — é o
único que existe daqui em diante.

## Dívida avaliada e roteada

Quatro pontas soltas foram avaliadas nesta rodada. Duas entram, duas viram
backlog, e o critério é o mesmo em todas: se a falha é silenciosa e na direção
verde, entra; se é ruidosa ou aparece na revisão, espera.

**Entra — exclusão de árvores na busca de fallback.** É defeito de qualidade no
diferencial do produto, e a correção exige documentar comportamento que já
existe sem requisito. `REQ-ANC-003` modificado.

**Entra — delta ilegível.** Silencioso e verde. `REQ-FMT-009`.

**Backlog — coverage não checa task reivindicando identificador que a change
não declara.** É lacuna real: uma change pode implementar o que nunca propôs.
Mas não é da família perigosa — a reivindicação fora de escopo não contribui
para nenhuma contagem, então nada passa em silêncio por causa dela; o requisito
sem task continua reprovando normalmente. Escrever o requisito agora seria
inventar critérios de aceite sem um caso real para calibrá-los.

**Backlog — `specd status` sem detector de camada desligada.** `verify` já
reporta: o relatório imprime `disabled in verify.levels` a cada rodada. Repetir
em outro comando é cobertura duplicada, não buraco. E depois desta change o
repositório passa a rodar as seis camadas, então o caso não existe aqui.

**Resolvido na Fatia 2 — `anchor fix`.** Entrou: `src/anchors/fix.ts` existe,
`REQ-ANC-008` está realizado com exit 2, e há teste. Não era ponta solta.

## Critério de sucesso

`specd verify` sai 0 sem nenhum warning, com a Fatia 3 arquivada e as seis
camadas ligadas. É a primeira vez que a spec inteira fica sob o gate sem
requisito em voo — nenhuma âncora pendurada, nenhuma camada desligada, nenhuma
change aberta.
