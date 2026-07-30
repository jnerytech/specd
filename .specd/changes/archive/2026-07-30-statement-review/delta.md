---
change: 2026-07-30-statement-review
target: [skills]
---

# Delta — statement-review

O enunciado passa a ter quem o leia: uma revisão barata quando ele nasce, e uma
estreita antes de congelar.

## ADDED

### REQ-SKL-007 — The proposing skill reviews every statement it writes

**Capability.** skills

**Statement.** WHEN the specd propose skill writes a requirement into a delta, the skill SHALL check that the statement carries one subject, that its quantification stays inside the reach of its anchors, and that every acceptance criterion names something a test can verify.

**Acceptance.**

- Statement com mais de um `SHALL`, ou com critério que descreve comportamento fora do assunto do statement, é apontado
- Statement que quantifica sobre um conjunto que as âncoras declaradas não alcançam é apontado
- Critério de aceite que nenhum teste conseguiria verificar é apontado
- Critério que proíbe uma ação futura do agente é isento do teste, e a revisão o nomeia como não-testável por construção em vez de deixá-lo passar calado
- O que a skill não consegue decidir vira pergunta ao autor, por REQ-SKL-005
- A skill não reescreve enunciado por conta própria

Corrigir aqui é gratuito: o requisito ainda é `origin: delta`, nenhuma task o
cita, nenhuma âncora tem histórico. Depois do archive o mesmo conserto é change
própria com MODIFIED, e trocar âncora vira churn de identificador.

A revisão é mecânica de propósito. Contar `SHALL`, comparar o que o statement
quantifica com o que as âncoras alcançam, e perguntar de cada critério se existe
teste que o verifique — três perguntas com resposta observável.

A terceira tem um limite, e o limite é estreito de propósito. Critério que diz
que a instrução está no `SKILL.md` é verificável por asserção sobre o texto —
fraca, e real. O que não tem verificação nenhuma é critério que **proíbe** uma
ação futura do agente: nenhuma asserção prova que algo não será feito. Só essa
forma é isenta.

A isenção larga — "requisito sobre comportamento de skill" — seria portão aberto,
e a população que o atravessaria é conhecida: três dos quatro enunciados fracos
deste repositório vivem na capability `skills` e se declarariam isentos. A exceção
engoliria a regra que este requisito existe para instituir.

Em troca de não ter teste, o critério isento é nomeado dentro da própria revisão
como não-testável por construção. Isenção anotada é diferente de isenção
implícita: a primeira deixa rastro de que alguém olhou, a segunda é indistinguível
de descuido — que é `absence-is-not-compliance` outra vez, agora sobre a revisão. O que sobra vai
ao autor em vez de virar juízo da skill, que é REQ-SKL-005 fazendo o trabalho que
já era dele.

```yaml anchors
- file: skills/specd-propose/SKILL.md
```

### REQ-SKL-008 — The archiving skill reviews what changed since the proposal

**Capability.** skills

**Statement.** WHEN the specd archive skill runs, the skill SHALL ask of every requirement that did not exist at proposal time, or whose text or anchor resolution changed since it, whether its anchors realize the behaviour the statement describes.

**Acceptance.**

- Requisito reescrito durante o apply entra na revisão
- Requisito que não existia no propose entra na revisão
- Âncora que passou de pendurada a resolvida entra na revisão, mesmo com a declaração inalterada
- Requisito inalterado e com âncora já resolvida no propose fica fora
- Âncora que resolve para símbolo que não realiza o comportamento enunciado vira pergunta ao autor, e o arquivamento espera
- A skill não reescreve âncora por conta própria

No propose essa pergunta não tem resposta: o requisito é `origin: delta` e o
símbolo pode não existir, então "a âncora realiza o comportamento?" só produziria
resposta inventada. No archive ela tem — o apply escreveu o código, e a âncora
que estava pendurada agora resolve.

Requisito que nasce durante o apply é a terceira entrada, e ele escapava das duas
janelas pela letra: não passou pelo propose, seu texto nunca foi *reescrito*, e a
âncora que ele declara aponta para código que já existe naquele instante, então
nunca esteve *pendurada*. É também o caminho mais provável de enunciado ruim —
escrito sob pressão de implementação, sem a cerimônia do propose. O passo de
`specd-apply-change` que manda escrever no delta o que a execução descobriu é a
razão de o delta ser a superfície de escrita, e era a porta por onde requisito
entrava sem ninguém ler.

O critério sobre requisito reescrito durante o apply não é exercitado por
nenhum dos quatro enunciados fracos, e fica assim mesmo, com a instância real
escrita ao lado: REQ-ARC-014 teve a âncora reescrita durante o apply, no mesmo
commit em que o símbolo nasceu — `export function` virou `export async function`
porque a resolução é literal. Critério cuja única evidência vem de fora do
conjunto de avaliação é mais fraco que os outros, e está declarado como tal.

Âncora que passou a resolver conta como mudança mesmo com a declaração intacta, e
essa leitura é o requisito inteiro. A âncora errada de REQ-SKL-003 nunca mudou de
texto: mudou de estado, e foi ao mudar de estado que virou observável. Ler "o que
mudou" como diferença de texto deixaria a segunda janela quase vazia.

O escopo é estreito porque o archive é o pior momento para descobrir enunciado
ruim — o gate está verde, as tasks estão fechadas, e voltar ao delta custa. Uma
revisão cara nesta posição é uma revisão que alguém pula, e revisão pulada é pior
que revisão ausente, porque parece existir.

```yaml anchors
- file: skills/specd-archive-change/SKILL.md
```
