---
change: 2026-07-29-declared-orphan-and-pending-retirement
status: active
---

# declared-orphan-and-pending-retirement — a órfã que a change `orphan-guard-and-documented-formats` isentou, e o intervalo que ninguém representa

## Por quê

Dois achados da exploração dos dois momentos de virar real. São pequenos, são
da mesma família, e um deles é a change `orphan-guard-and-documented-formats` corrigindo o sintoma e o sintoma
sobrevivendo no único caminho que ela não cobriu.

**O buraco.** `assertNoUndeclaredOrphans` filtra `!orphan.declared`. Órfã
declarada vai direto para `closed`, sem passar pelo `bodyKey`. Então renomear um
requisito **já realizado** — `REMOVED: REQ-002` mais `ADDED: REQ-009`, mesmo
corpo — fecha o card e cria outro, sem uma palavra. É exatamente o achado do run
006, no caminho que a change `orphan-guard-and-documented-formats` isentou por construção.

Pela letra de costly-ops-are-not-silent o autor declarou uma morte e recebeu uma morte. Pelo teste de
costly-ops-are-not-silent — o custo é visível no momento em que é pago — escrever `- REQ-002` numa
lista não mostra que um card com quarenta horas apontadas fecha. Declaração que
não exibe o preço não é o mesmo que declaração.

**O intervalo.** Requisito sob REMOVED sai da spec efetiva quando a change abre
e só entra em `retired` quando ela arquiva. No meio, o card vira órfã não
declarada e `sync` recusa até o `archive` rodar. Registrado no run 007 §4 como
consequência que caiu de pé.

A causa é que **ADDED e MODIFIED têm duração no modelo e REMOVED é
instantâneo.** Os outros dois carregam as três marcas de período — task
obrigatória, `origin: "delta"`, âncora rebaixada a warning. Remoção não carrega
nenhuma. `coverage.ts` escreve a premissa em prosa, como decisão deliberada:
"REMOVED needs no task. Deleting a section is what `archive` does, not work
somebody schedules." Coerente enquanto nada observa o intervalo. O board
observa.

## O que esta change não decide

**Não muda `effectiveSpecs`.** Dar duração à remoção obriga a dar representação
a ela, e o custo é real: o requisito continua na spec efetiva enquanto a change
apaga o código dele, a âncora pendura, e como `origin` é `specs` isso é erro e
segura o gate vermelho a change inteira. Sombreamento não resolve, porque o
substituto tem outro identificador. Precisaria de um terceiro `origin` e
reabriria a quarta decisão de `coverage`.

Nada disso é necessário aqui. `buildSpecTree` já chama `readOpenChanges`, então
o sinal "esta morte está proposta" já está no disco e não é lido — mesma espécie
da correção da change `orphan-guard-and-documented-formats`. Ler o sinal destrava o `sync` sem decidir a pergunta dos
dois momentos, que continua aberta e continua sem prazo.

**E não é fechar no proposto.** Change abandonada teria fechado card de morte
que nunca aconteceu. Proposto deixa em paz e relata.

## Escopo

### 1. Órfã declarada com corpo reaparecendo também recusa

Espelha o caminho não declarado. A ordem de classificação passa a ser corpo
primeiro, declaração depois:

| órfã | ação |
| --- | --- |
| corpo bate em item planejado sem ligação | **recusa**, nomeia os dois |
| identificador sob REMOVED de change aberta | **deixa em paz**, relata |
| identificador em `retired` | fecha |
| nada corresponde | **recusa** |

Corpo batendo vence declaração porque é o único par de estados cuja diferença é
destrutiva numa direção só, e é no-guessing-on-conflict literal: dois estados possíveis, indício
forte, nenhuma prova. A saída continua sendo uma edição de uma linha que o autor
faz vendo o que troca.

### 2. Morte proposta deixa o item em paz e aparece no relatório

Órfã cujo identificador está sob REMOVED de change aberta não fecha, não recusa
e não some do relatório. Ganha um resultado próprio.

Silenciar seria absence-is-not-compliance pela definição: verificou, encontrou algo, e não contou. O
número existe para que alguém que roda `sync` no meio de uma change de remoção
saiba por que o card continua aberto — sem precisar deduzir do que não foi
impresso.

## costly-ops-are-not-silent e no-llm-in-decision-path, já aplicados

no-llm-in-decision-path ganhou a segunda justificativa em AGENTS.md e CLAUDE.md, escrita antes desta
change porque governa como ela é construída: determinismo protege o exit code,
**irreversibilidade protege a escrita externa**, e a assimetria é o motivo —
exit code errado se roda de novo, card fechado com as horas de alguém dentro
não.

A extensão não é retórica. Ela é o argumento decisivo contra a rota que parecia
mais conservadora — declarar transições no delta —, e está registrada como tal
no candidato abaixo.

## Candidato registrado, não dívida — agora com duas razões

**A ligação viajando com o bloco do requisito**, um fence `yaml board` ao lado
do `yaml anchors`, em vez de mapa no frontmatter chaveado por identificador.
Identidade por continência em vez de por nome.

**Primeira razão, da change `orphan-guard-and-documented-formats`.** Renomear volta a ser grátis de verdade, sem
comando e sem sinal novo, e a **divisão** de um requisito ganha resposta: quem
fica com o card é decidido por onde o autor deixa o bloco, visível no diff.
Nenhuma outra opção responde a divisão. A hipótese que promoveria o candidato é
divisão de requisito virar operação comum, e hoje não é.

**Segunda razão, independente da primeira.** A alternativa óbvia — vocabulário
de transição no delta, `RENAMED` e `SPLIT` — é a que no-llm-in-decision-path estendido rejeita. Se a
transição é declaração, e o escritor confiável dela é `propose`, então escrita
destrutiva no board de um cliente passa a ser decidida por saída de LLM. Não é
no-llm-in-decision-path na letra, porque exit code nenhum depende disso; é no-llm-in-decision-path na razão, e com força
maior, porque o erro não é recuperável. Pior que adivinhar: obedecer a um
palpite, que parece declarado.

As duas razões são independentes porque partem de premissas diferentes e
sobrevivem uma sem a outra. A primeira depende de divisão virar comum e cai se
não virar. A segunda vale mesmo que ninguém nunca divida requisito, porque ela
não é sobre divisão — é sobre quem tem autoridade para declarar uma morte.

Continua candidato. Duas razões não é o mesmo que uma, e ainda não é dívida.

## Fora de escopo

`effectiveSpecs` com remoção durável, e a pergunta dos dois momentos de virar
real, que segue aberta e cujo relógio continua sendo divisão de requisito virar
comum. `propose`, `apply` e memória. A ligação viajando com o bloco, candidato
acima.

## Reincidência, ainda contada e ainda não consertada

`0/0 tasks done` continua na quarta. O gatilho combinado vale: se voltar uma
quinta vez, vira trabalho próprio.
