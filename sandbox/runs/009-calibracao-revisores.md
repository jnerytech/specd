# Run 009 — Calibração dos revisores, e o instrumento se medindo sozinho

- **Quando:** 2026-07-29
- **Versão avaliada:** specd em `fc0de9d`. Não é o produto que está sob teste
  aqui, e sim o painel de `code-reviewer` que o CLAUDE.md manda usar antes de
  commit e antes de archive
- **Alvo:** quatro diffs com defeito conhecido, três reais e um controle
- **Veredito:** o painel achou 2 dos 3 defeitos plantados, e **só 1 dos 3
  chegou aos 80** do corte. O controle só passou a se comportar como controle
  depois de duas fontes de vazamento serem fechadas — e as duas eram minhas.
  "Zero achados" não é garantia de nada; é o resultado esperado de um painel
  que erra assim.

> Run, não change: mede o instrumento, não o produto.

## Montagem

Para cada defeito, um worktree destacado no commit que o introduziu, mais o
diff puro (`git diff C^ C`, sem mensagem de commit — a mensagem entregaria a
intenção). O revisor não tem Bash, então lê só a árvore daquele instante e não
alcança commit futuro.

Painel de três por diff, replicando o que o CLAUDE.md prescreve: um de
correção, um de qualidade e cobertura, um só de P1–P9. Nenhum sabia que havia
defeito plantado. Doze revisões na primeira rodada, mais três de repescagem no
controle.

| # | Defeito | Introduzido em | Diff revisado |
|---|---|---|---|
| D1 | `!orphan.declared` — órfã declarada fecha card sem passar pelo corpo | `079312f` (Fatia 7) | `src/sync/index.ts`, `src/sync/errors.ts` |
| D2 | marcador literal `"specd hooks run"` | `f317113` (Fatia 5) | `src/hooks/settings.ts` |
| D3 | `readActiveChange` devolve `listChanges(root)[0]`, ordem ascendente | `1457e0a` | `src/verify/active-change.ts`, `layers/anchors.ts` |
| D4 | controle — 204 do tracker sem workflow | `0ceef97` (Fatia 6) | `src/sync/adapters/redmine.ts` |

**D4 é reconstruído, não histórico.** O 204 foi descoberto dentro da própria
Fatia 6, e `0ceef97` já chega com a releitura no `close`. Não existe commit com
a versão ingênua. Escrevi a versão ingênua — `PUT` e retorna, sem `GET` de
conferência — para produzir o diff. É o código como teria sido escrito, mas é
meu.

## Resultado

Nota é a confiança que o próprio revisor declarou. ✅ = achou o defeito
plantado.

| Diff | Correção | Qualidade | Princípios |
|---|---|---|---|
| D1 órfã declarada | ✗ — achou outro defeito, 85 | ✗ — 65, 55 | ✗ — zero achados |
| D2 marcador literal | ✅ **92** | ✗ — achou outro defeito, 75 | ✗ — 55 |
| D3 `listChanges()[0]` | ✅ 80 | ✅ 50 | ✅ 70 |
| D4 controle (limpo) | ✗ 55, declarado não verificável | — | ✗ — abaixo de 50 |

Dois dos três defeitos plantados foram achados por algum revisor. **Um único
achado passou dos 80.** D3 foi achado pelos três, e mesmo assim só um deles
chegou ao corte: 80, 70, 50 para o mesmo defeito, decidido pelo foco do
revisor, não pela dificuldade do defeito.

D1 é zero limpo. Os três leram o diff que a Fatia 8 veio consertar e nenhum
viu que o ramo `declared` fecha sem olhar o corpo.

## O controle não era controle, e a culpa é da montagem

O controle achou o 204 nas duas primeiras rodadas, com 90. As duas por
vazamento, e cada vazamento tem uma causa diferente.

**Primeiro vazamento — o `CLAUDE.md` atual entra no contexto do subagente.**
O harness injeta o `CLAUDE.md` do diretório da sessão, não o do worktree. O
`CLAUDE.md` de hoje traz a lista de instâncias do P8, com o 204 nomeado, a
causa e o conserto. Higienizei o worktree (o `delta.md` da Fatia 6, o README e
o `seed.sh` do teste de integração) e deixei o gabarito no contexto.

A prova é contraste interno, no mesmo diff: os dois revisores que "acharam"
citaram texto que só existe na versão atual — *"Corrigido na Fatia 6: `close`
relê e falha quando a situação não mudou"* — e `grep -c 204` no `CLAUDE.md` do
worktree devolve zero. O terceiro declarou usar só os documentos do checkout,
examinou a ausência de releitura e **recusou pontuar acima de 50**, dizendo que
a responsabilidade poderia ser do orquestrador ainda não construído.

**Segundo vazamento — a promessa da releitura ficou no código.** Removi a
releitura do `close` e deixei a afirmação dela em três lugares que meu diff nem
tocava: o comentário do chamador (`src/sync/index.ts:264` — *"This is the
single status write, and the adapter reads back to confirm it landed"*), o
comentário do teste de integração, e o nome do teste
(`"...and confirms it landed"`). Com o primeiro vazamento fechado, dois
revisores independentes acharam de novo por essa rota, com 90 e 85, e um deles
escreveu explicitamente *"not a guess about vendor behavior"*. Estava certo.

Com as três promessas removidas, a nota caiu para **55**, com a ressalva
declarada de que a alegação depende de comportamento de fornecedor que o
checkout não permite verificar. Esse é o comportamento que o controle previa,
e é a única das três rodadas que mede o revisor em vez de medir o vazamento.

**E isso já é um resultado, antes da nota.** O 204 nunca foi invisível em
código. No instante em que o adaptador foi escrito, a releitura já estava
prometida em três arquivos, porque o conserto nasceu no mesmo commit. A
premissa do controle vale para um estado do repositório que nunca existiu, e
cada patch meu para recriá-lo me afastava do histórico e me aproximava de estar
medindo a minha própria ficção.

## Leitura

Nenhum dos três cenários previstos aconteceu limpo. O que os dados dizem:

**O corte em 80 descarta verdadeiro positivo.** Tudo que o painel achou por
leitura ficou entre 50 e 92, e a nota acompanhou o foco do revisor mais que a
gravidade do defeito. D3 tirou 80, 70 e 50 pelo mesmo achado. Um painel que
filtra em 80 teria reportado D3 uma vez e D1 nenhuma.

**"Zero achados" não é garantia.** D1 é a demonstração: três revisores, um
deles lendo o P9 que aponta para a área exata, e zero. Se o painel produz zero
num diff que tem defeito conhecido, zero num diff desconhecido não distingue
"não tem" de "não vi". É o P8 aplicado ao próprio método — ausência de achado
não é conformidade — e é por isso que o zero da Fatia 8 vale menos do que
parecia valer.

**O painel achou coisa que ninguém plantou, e uma delas parece viva.** Ver
abaixo. Isso é argumento a favor de continuar rodando o painel; não é argumento
a favor de acreditar no silêncio dele.

**O corte funciona na direção defensiva.** Com os dois vazamentos fechados, o
controle caiu de 90 para 55 e o revisor declarou espontaneamente o limite do
que podia verificar. Não houve invenção de comportamento de servidor sem
apoio — houve repetição de documento quando o documento estava lá.

## Achados laterais, não plantados

**Órfã de nível `task` nunca pode ser declarada — plausível, não reproduzido.**
O revisor de correção de D1 alegou isso com 85, e o código em `fc0de9d`
sustenta a leitura: a chave de item de task é `${task.change}/${task.id}`
(`src/sync/index.ts:736`), `retired` só aceita identificador que casa
`REQ_ID_PATTERN` (`src/parser/capability.ts:256`), e a classificação da Fatia 8
é `retired` → `retiring` → `none` (`src/sync/index.ts:144`). Chave de task não
casa o padrão, então cai em `none`. Mapear `task` sem colapsar é configuração
suportada (`src/sync/mapping.ts:107`). Se procede, arquivar change com card de
task trava `sync` para sempre, e as duas saídas que a mensagem de erro oferece
não se aplicam. **Falta repro:** workspace com `task` mapeado e change
arquivada. Enquanto não houver, é leitura de código.

**`assertHooksShape` não valida elemento de array interno.** `{"hooks":
{"Stop":[{"hooks":[null]}]}}` passa pela validação e estoura `TypeError` cru em
`isSpecdHook`, em vez do `OperationalError` que nomeia o arquivo. Achado com 75
e 60 por dois revisores de D2, independentes. O exit code continua 2, então não
fere o contrato — fere a promessa de diagnóstico do REQ-HOOK-003.

## O padrão, agora com quatro instâncias

**Coerência empurrando para o requisito errado.** Escrever o que combina com o
texto vizinho em vez do que foi conferido.

1. Vocabulário, na Fatia 7
2. Princípio, na Fatia 8
3. Os quatro REQ-IDs citados sem verificação
4. **Novo, aqui:** o revisor de princípios de D1 leu no P9 que "a fatia
   corrente conserta" o `sync` que fecha card de órfã, viu que o diff era esse
   conserto, e concluiu que estava completo — nas palavras dele, "não encontrei
   caminho onde este diff feche item sem a órfã estar declarada como retired".
   Literalmente verdadeiro, e é exatamente o buraco: quando *está* declarada,
   fecha sem olhar o corpo.

E uma quinta, da mesma família, se contar o controle: dois revisores relataram
o 204 com 90 porque o documento no contexto dizia que ele estava ali.

Dois atores — o autor e o revisor — e um terceiro agora, o revisor automático.
O modo de falha não é de nenhum deles em particular: é do texto bem escrito
perto do código. Documento que explica o defeito consertado ocupa o mesmo lugar
que a evidência ocuparia, e quem lê não distingue "verifiquei" de "estava
escrito".

**Recomendação:** quatro instâncias em três fatias não cabem mais num run
descartável. O lugar durável é a linha do painel de revisores no CLAUDE.md e no
AGENTS.md — a regra prática que sai daqui é que **achado que cita documento de
governo precisa citar também a linha de código que o confirma**, e revisão que
não achou nada relata o que procurou, não só o silêncio. Não escrevi isso nos
documentos: é mudança de governo, e a decisão é do autor.

## O que faltaria para o controle valer

Reconstruir o estado pré-descoberta inteiro, não só o `close`: o comentário do
chamador, o comentário e o nome do teste, o critério de aceite no `delta.md`, o
README e o `seed.sh` do container. Fiz os cinco últimos em três patches
sucessivos, cada um depois de um revisor achar pela porta que o anterior deixou
aberta — o que é, por si, a medida de quantos rastros um conserto deixa fora do
código que ele conserta.

O caminho que o harness não deixa fechar continua aberto: o `CLAUDE.md` do
diretório da sessão entra no contexto de todo subagente. A mitigação usada aqui
foi instruir o revisor a descartar qualquer outra cópia da documentação, e ela
funcionou — mas é instrução, não isolamento, e vale enquanto o revisor obedecer.
