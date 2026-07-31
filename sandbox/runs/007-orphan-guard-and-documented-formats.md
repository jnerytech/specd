# Run 007 — Fatia 7, o laço fechado

- **Quando:** 2026-07-29
- **Versão avaliada:** specd em `8e5d0f7`, fim da Fatia 7
- **Alvo:** Redmine 6.1.3 local semeado, mais o próprio repositório
- **Veredito:** os nove requisitos estão implementados e medidos. Os três
  caminhos de órfã foram provados contra o container, inclusive o do meio, que é
  o que reproduz o achado do run 006 — a correção deixou de ser argumento. Dois
  requisitos pediram decisão que a spec não tinha tomado, e um teste da Fatia 6
  precisou ser corrigido porque codificava o comportamento errado.

> Registro imutável. 464 testes offline, 22 de integração.

---

## 1. Os três caminhos de órfã, contra o servidor

Medidos em `test/integration/redmine/orphans.test.ts`, cinco casos.

**Caminho 1 — morte declarada.** Identificador em `retired`, card fecha,
ligação sai do frontmatter. Confirmado lendo `is_closed: true` do Redmine.

**Caminho 2 — o do run 006.** Renomear `REQ-DEMO-002` para `REQ-DEMO-009`:

```
UndeclaredOrphanError: 1 board link no longer has a requirement in the spec,
and its identifier is not listed as retired.
  REQ-DEMO-002 -> http://localhost:18080/issues/60 (ref 60)
      same body as REQ-DEMO-009 — probably a rename, but specd does not decide that
specd will not close a board item it was not told to close. Either:
  - rename the key under `board:` in the capability frontmatter, if the requirement was renamed
  - or add the identifier to `retired` in that frontmatter, if it really is gone
Nothing was written, to either side.
```

O teste confirma no board que o card continua **aberto**, que nada foi criado
para o identificador novo, e que a ligação antiga continua intacta. Antes desta
fatia, a mesma edição fechava o card e criava outro.

Um sexto caso segue as instruções da própria mensagem — trocar a chave à mão — e
confirma que o resultado é um `push`, não um `create`: o card sobrevive à
renomeação com a história dentro dele.

**Caminho 3 — sumiu sem correspondência.** Recusa, sem citar rename, card
aberto.

**Raio de alcance.** Um quinto teste edita um requisito sadio junto com a órfã e
confirma que o `updated_on` do card sadio **não se mexeu**. A recusa é global,
como a de conflito: meia execução deixaria o board num estado que nem a spec nem
o board descrevem.

---

## 2. As duas decisões que a spec não tomou

O enunciado pediu para reportar isto, e aconteceu duas vezes.

### REQ-SYNC-015 dizia "projeção idêntica"

Escrito assim, o requisito **nunca pegaria o caso que existe para pegar**. O
título de um item é `${identificador} — ${título}`, então renomear muda o título
por construção, e projeção idêntica nunca casa numa renomeação.

O sinal certo é o **corpo**, que é justamente o que a renomeação não toca.
Corrigido no delta antes de implementar — requisito em voo, custo zero —, e a
razão ficou escrita no próprio requisito em vez de virar comentário no código.

Vale registrar como o defeito nasceu: escrevi "projeção" porque é o vocabulário
que o resto da capability usa, e não porque tinha verificado que ele servia
aqui. Coerência de vocabulário empurrando para o requisito errado.

### REQ-ARC-013 dizia "sem ligação ou com ligação velha"

"Ligação velha" não é detectável offline. O `synced_hash` gravado cobre os campos
customizados, e saber quais são exige `/custom_fields.json` — rede. Comparar sem
eles faria todo item parecer velho.

O que é detectável sem rede, e é exato para o caso do archive: item **sem
ligação** (tudo que o delta adiciona) e item que o delta **reescreveu** e que já
tem ligação. Sai do delta aplicado mais as ligações gravadas, sem requisição
nenhuma.

Ficou melhor que a redação original, e o preço está declarado: não enxerga card
apagado no board. Menos preciso de propósito.

---

## 3. O teste da Fatia 6 que codificava o comportamento errado

`sync.test.ts` tinha um teste chamado *"closes the board item of a requirement
that left the spec"*. Ele removia o bloco do requisito e esperava o card fechar.

Na Fatia 7 ele quebrou, e quebrou **corretamente**: remover o bloco sem declarar
em `retired` é exatamente o caso que passou a ser recusado.

O teste foi renomeado para *"...of a requirement declared retired"* e passou a
usar `retire`. Não é o teste consertado — é o teste que estava provando o
defeito, e que agora prova a correção.

Isto é o que um teste de integração escrito contra comportamento observado
compra: ele falha quando o comportamento muda, mesmo quando a mudança é a certa,
e obriga alguém a dizer qual das duas versões é a verdadeira.

---

## 4. Uma consequência que ninguém tinha previsto

**Requisito sob REMOVED sai da spec efetiva no instante em que a change abre.**

Descoberto porque um teste de `archive --sync` falhou: eu tentei sincronizar
primeiro e arquivar depois, e o card do requisito a ser removido nunca chegou a
existir. O `effectiveSpecs` aplica `specs ⊕ ADDED ⊕ MODIFIED ⊖ REMOVED`, então
o requisito some assim que o delta o lista.

Encadeando com a Fatia 7: se o card **já existia** antes da change, abrir a
change o transforma em órfã não declarada — e `sync` passa a **recusar** até o
`archive` rodar, porque `retired` só é populado no archive.

Isso é coerente e não é óbvio. A morte está proposta, não declarada; recusar é
honesto. Mas significa que, com uma change de remoção aberta, `specd sync` fica
travado e `archive --sync` é o único caminho. Está medido num teste que afirma
as duas coisas em sequência.

Não é defeito nesta fatia. É desenho que caiu de pé por acidente, e é o tipo de
coisa que só aparece rodando as duas metades juntas.

---

## 5. O `blocked`, e o que ele mudou de forma

A camada `project` ganhou um quarto estado. `verify` agora distingue:

```
 ok    passou
 fail  rodou e reprovou          -> exit 1
 ????  não conseguiu rodar       -> exit 2
 skip  desligada ou --fast
```

`dotnet` ausente sai 2 e diz as três saídas — instalar, trocar
`validation_command`, tirar `project` de `levels`. Comando que existe e retorna
não-zero continua saindo 1, porque continua sendo veredito.

O hook acompanhou: camada bloqueada continua bloqueando o agente — P8, o
terceiro resultado nunca é verde —, mas a mensagem deixou de dizer "a spec e o
código discordam", que era falso.

---

## 6. O contrato que a prosa ganhou

**Template do `init`.** As seis chaves que faltavam entraram, e um teste
percorre `ConfigSchema` recursivamente exigindo cada uma. Um segundo teste
injeta uma chave fictícia e confirma que o primeiro falharia — sem ele, o teste
poderia estar passando por não olhar nada.

**`docs/format.md`.** Publica capability, delta e task completos, e um teste
extrai os exemplos **da própria página** e os passa por `parseCapability`,
`parseDelta` e `parseTask`. Um teste a mais afirma que três exemplos foram
encontrados: zero tornaria todos os outros vazios, que é o P8 de sempre.

Prettier encurtou o fence de um dos exemplos de quatro crases para três, e
quebrou a extração. Duas saídas: isentar a página do formatador, ou fazer o
extrator aceitar os dois tamanhos. Escolhi a segunda — isentar arquivo do
formatador é o que já custou os runs 001–003, e não vale repetir para não
escrever uma regex com backreference.

**README.** Seção de como rodar do clone, e um teste amarrando o caminho citado
ao `bin` do `package.json`. Só isso é gatilhável; o resto é prosa e está
declarado como prosa no proposal. Um teste que só afirmasse "o README menciona
build" passaria sem checar nada, que é P8 dentro do CI.

---

## 7. Números

| | |
| --- | --- |
| Testes offline | 464 (eram 429) |
| Testes de integração | 22 (eram 11) |
| Requisitos em `.specd/specs/` | 102, em 10 capabilities |
| Âncoras penduradas | 0 |
| `npm run verify` | verde, seis camadas |
| `npm run test:integration` | verde |

---

## 8. O que este run deixa aberto

**A quinta reincidência de ausência lida como conclusão ainda não veio.** O
`0/0 tasks done` continua lá, registrado no proposal como reincidência com o
gatilho combinado: se voltar mais uma vez, vira trabalho próprio.

**`sync` travado com change de remoção aberta.** Descrito na §4. Coerente, não
documentado fora deste run, e ninguém decidiu que é o comportamento desejado —
ele caiu de pé.

**A pergunta dos dois momentos de virar real continua aberta**, agora com uma
instância concreta a mais: a §4 é ela aparecendo do lado da remoção, do mesmo
jeito que a renomeação a fez aparecer do lado da criação.

**Candidato da ligação no bloco continua candidato.** Nada nesta fatia mexeu na
hipótese que o promoveria — divisão de requisito virar operação comum.

**Ainda um adaptador só.** Terceira fatia consecutiva registrando isto.
