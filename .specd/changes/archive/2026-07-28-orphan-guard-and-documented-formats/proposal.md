---
change: 2026-07-28-orphan-guard-and-documented-formats
status: active
---

# orphan-guard-and-documented-formats — fechar o laço, e parar de mentir na prosa

## Por quê

Duas coisas se juntaram e apontam para a mesma change.

A primeira é o `sync` fechando card de qualquer ligação órfã, sem perguntar.
Apareceu como problema de renomeação, mas renomear foi só o caminho até ele: um
identificador digitado errado fecha o card de um cliente, e o card leva junto
comentário, anexo e apontamento de hora que alguém deixou ali. É o espelho do
achado do 204 da change `board-sync-redmine` — lá, escrita que reporta sucesso sem acontecer; aqui,
escrita destrutiva que acontece sem ser pedida.

A segunda é o run 006. O caminho `init → verify → sync` funciona em dez passos,
e a documentação não leva ninguém até ele: o primeiro comando do README dá 404,
o `config.toml` que o `init` escreve não menciona `sync` sob uma linha
afirmando que menciona tudo, e metade da ferramenta — `changes/` — não tem
formato documentado em lugar nenhum.

As duas têm a mesma causa de fundo, e é ela que a change ataca: **afirmação
verificável escrita em prosa, com nada verificando.** A change `project-root-and-file-visibility` registrou o
padrão e resolveu um caso. Ele voltou em cinco lugares novos.

## A decisão do §8, e o que ela revelou

Renomear requisito num delta fechava e recriava card. A política dizia que
renomear em voo não custa nada. As duas não podiam coexistir.

**A política estava errada antes do board.** O motivo que ela alegava — "ainda
não há task citando o ID" — é falso: requisito em delta *precisa* de task
citando o identificador, senão `coverage` reprova. Renomear nunca foi grátis.
Era barato e mecanicamente cobrado.

O invariante que sobrevive não é "renomear é grátis". É **o custo é visível no
momento em que é pago** — que virou costly-ops-are-not-silent, porque vale muito além de renomear.

**A peça não estava faltando no modelo.** `retired` já existe e já é populado
pelo `archive`, que acrescenta a ele todo identificador sob REMOVED. O modelo
tem o sinal de morte declarada. O `sync` é que não o lia: comparava chaves
ligadas contra chaves planejadas e tratava toda diferença como morte.

Daí a saída escolhida — recusar em vez de adivinhar, e ler o sinal que existe:

| Ligação órfã                                        | Ação      |
| ---------------------------------------------------- | --------- |
| identificador está em `retired`                       | fecha     |
| sumiu, e reapareceu outro com projeção idêntica       | **recusa**, nomeia os dois |
| sumiu, e nada corresponde                             | **recusa** |

no-guessing-on-conflict literal, e a saída é uma edição de uma linha que o autor faz vendo o que
troca. Custa zero mudança de formato e nenhum conceito novo.

Renomear continua não sendo grátis. Passa a ser **barato e recusado até ser
declarado**, que é a forma do resto do produto.

## O que isto revelou, e que esta change não fecha

**`sync` publica requisito que ainda está em delta.** Então um requisito fica
externamente real no `sync` e internamente real no `archive`. São dois momentos
de virar real, e a política só conhecia o segundo — é por isso que ela podia
dizer "em voo não custa nada" e estar errada.

Fica registrado e não resolvido. A saída óbvia — sincronizar só verdade
realizada — deixaria a política verdadeira sem emenda e tornaria o
`archive → sync` trivial, mas tira do board a função de planejamento, que é a
função principal dele. Preço alto demais para pagar de passagem.

Registrar importa porque **"`archive → sync` é obrigatório ou eventual" é filha
desta pergunta.** Quem responder uma responde a outra, e é melhor responder
sabendo disso.

## Candidato registrado, não dívida

**A ligação viajando com o bloco do requisito** — um fence `yaml board` ao lado
do `yaml anchors`, em vez de mapa no frontmatter chaveado por identificador.
Identidade por continência em vez de por nome: renomear volta a ser grátis de
verdade, sem comando e sem sinal novo, e a **divisão** de um requisito ganha
resposta — quem fica com o card é decidido por onde o autor deixa o bloco,
visível no diff. Nenhuma outra opção responde a divisão.

Não entra agora, e o motivo decisivo não é o custo de mudar REQ-SYNC-007: é que
o item de nível capability não tem bloco de requisito onde morar, então a
ligação dele continuaria no frontmatter. Dois mecanismos coexistindo é pior que
um imperfeito.

Candidato, não dívida. A diferença importa: dívida é algo que se deve pagar,
candidato é algo que se paga se a segunda hipótese se confirmar. A segunda
hipótese aqui é a divisão de requisito virar operação comum. Hoje não é.

## Escopo

### 1. Órfã não declarada recusa

`sync` lê `retired` e só fecha o que foi declarado morto. Órfã sem declaração
para o comando inteiro, nomeando o identificador, o card e o que fazer. Quando
existe um item novo com projeção idêntica à do card órfão, a mensagem nomeia os
dois e diz que é rename provável — sem decidir.

Vem primeiro porque o item 2 depende dele: `archive` popula `retired`, então o
`sync` que roda depois de um `archive` precisa saber ler esse sinal para fechar
o que deve e recusar o resto.

### 2. `archive` chama `sync`

Três perguntas de desenho, com recomendação. **Nenhuma implementada até
confirmação.**

**Obrigatório ou eventual?** Recomendo **opt-in explícito**: `archive --sync`.

REQ-SYNC-001 diz que `sync` escreve no board só quando invocado diretamente por
uma pessoa. `archive` sincronizando por conta própria quebra o requisito.
`archive --sync` não quebra: continua sendo uma pessoa digitando, e a escrita
externa continua declarada — costly-ops-are-not-silent. Sem a flag, `archive` relata quantos itens
ficaram para sincronizar e manda rodar `specd sync`.

Relatar e não agir seria suficiente para a correção, mas erra no caso comum,
que é esquecer. A flag transforma dois comandos num ato deliberado sem
transformar nenhum ato em automático.

**Falha depois das capabilities escritas?** Recomendo **não desfazer nada, sair
2, e dizer exatamente onde parou.**

A ordem é `archive` primeiro, `sync` depois. Se `sync` falhar, a spec está
adiante do board, e essa é a direção segura: a spec é o contrato e o board é a
projeção. `sync` é idempotente, então rodar de novo alcança.

A ordem inversa — sincronizar antes de aplicar — deixaria o board adiante da
spec se o `archive` falhasse, que é a direção errada: cards para requisitos que
o repositório não reconhece.

Desfazer o `archive` seria pior que ambas. O que ele escreveu está correto e
está fora do índice, ao alcance da revisão (costly-ops-are-not-silent). Desfazer destrói trabalho bom
por causa de uma falha de rede.

A contagem que `archive` faz sem `--sync` sai das ligações gravadas, sem
consultar o board. Isso é a segunda vez que a mesma regra decide um desenho, e
ela não estava escrita em lugar nenhum: **quem não precisa da rede não a
exige.** gate-no-network é a instância forte — o gate nunca acessa a rede, e há teste de
arquitetura para isso —, mas o princípio é mais largo que o gate. `archive` sem
`--sync` não precisa do board para contar o que ficou para trás, então não pede
o board; se pedisse, uma operação puramente local passaria a falhar em avião, em
CI sem egresso e em cliente atrás de proxy. Cada dependência de rede que não é
necessária é um lugar a mais onde a ferramenta para de funcionar por motivo que
não é dela.

O preço está declarado no requisito: a contagem enxerga ligação ausente e
ligação velha pelo hash local, e não enxerga card apagado no board. Menos
preciso de propósito.

**Existe `--no-sync`?** Recomendo **não**.

Com `sync` opt-in, a ausência da flag já é o não. Duas flags para um booleano é
botão que existe sem dois clientes reais divergindo — config-only-on-divergence. Se a resposta à
primeira pergunta virar "obrigatório", então `--no-sync` passa a ser necessário,
e as duas decisões andam juntas.

### 3. As três do run 006, na ordem que ele deu

**Como executar a partir do fonte.** README e AGENTS.md. É a única parede
absoluta do onboarding, está no primeiro passo, e some com três linhas. Enquanto
`specd` não estiver publicado, o README não pode abrir com `npx specd` sem
dizer o que fazer enquanto isso.

**Teste afirmando que toda chave de `ConfigSchema` está no template do `init`.**
O template abre com "Every section below is supported" e omite seis chaves —
quatro do `sync`, duas do transporte MCP que faltam desde antes da change `board-sync-redmine`. O
defeito é da mesma família que a lista de camadas resolvida na change `project-root-and-file-visibility`, e a
verdade está num objeto exportado a dois `import` de distância.

**Formato de `delta.md` e `tasks/*.md` documentado.** São metade do produto —
alimentam `coverage` e `evidence`, e são o Modelo B inteiro. Custaram seis
voltas de adivinhação no run 006, ensinadas exclusivamente por mensagem de
erro. Sem `propose`, escrever à mão é o único caminho, e é o não descrito.

### 4. `validation_command` ausente sai 2, não 1

`dotnet` não instalado reprova o gate como se a spec estivesse errada. O README
vende exatamente a distinção que isso quebra: CI precisa separar "spec
reprovou" de "ferramenta quebrou". Executável ausente é ferramenta quebrou.

É a mesma forma do absence-is-not-compliance uma casa acima: não é verde onde deveria ser vermelho, é
vermelho do tipo errado. O CI que confia na distinção age errado.

A separação a fazer é entre o comando não existir — operacional — e o comando
existir e falhar, que continua sendo veredito do gate.

### 5. costly-ops-are-not-silent escrito nos documentos de governo

Já aplicado a este repositório, porque governa como o resto da change é
construído: escrito em AGENTS.md e CLAUDE.md, e a frase errada da política de
requisito maleável foi substituída em vez de emendada.

costly-ops-are-not-silent é princípio e não requisito pelo mesmo motivo de anchor-necessary-not-sufficient: decidir se uma operação
"custa alguma coisa" é julgamento, e no-llm-in-decision-path mantém julgamento fora do caminho de
decisão. O que dá para verificar por máquina são instâncias particulares — que
`archive` não estaga, que `sync` recusa — e essas viram requisito.

## Reincidência, contada e não consertada

`specd status` mostra uma change sem delta e sem task como `0/0 tasks done`.
Não é falso, e é o problema: "nada a fazer" e "nada declarado ainda" saem
idênticos, e o segundo lê como conclusão.

É a **quarta** vez que ausência lê como conclusão dentro do specd. As três
primeiras estão em absence-is-not-compliance, e todas eram sobre o que a ferramenta lê:

1. diretório sem `.specd/specs/` passava no gate
2. delta ilegível era lido como delta vazio
3. a busca de âncora enxergava zero arquivos

Esta é diferente em um ponto que vale registrar: as três primeiras eram a
ferramenta se enganando sobre o mundo. Esta é **a ferramenta se enganando no
que conta sobre si mesma** — o relatório de estado, que é onde alguém vai
justamente para saber se pode confiar no resto.

Fica anotada como reincidência e não como item. Uma change sem delta é um
estado legítimo e curto, o dano é pequeno, e abrir trabalho por ele agora
custaria mais atenção do que ele merece. **Se voltar uma quinta vez, vira
trabalho próprio** — quatro é padrão, cinco é padrão que ninguém está tratando.

## Fora de escopo

`--dry-run`, que já existe desde a change `board-sync-redmine`. A ligação viajando com o bloco, que
é candidato registrado acima. `propose`, `apply` e memória. A pergunta dos dois
momentos de virar real, registrada e deliberadamente aberta.

## O que fica aberto por escolha

Documentar formato não impede formato de mudar sem a documentação acompanhar —
é prosa, e prosa não tem gate. O item 3 troca "não documentado" por
"documentado e sem contrato", que é melhor e não é seguro. O que seria
gatilhável ali é uma lista de exemplos que o próprio parser lê, e isso não está
nesta change.
