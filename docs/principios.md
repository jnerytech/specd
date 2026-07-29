# Princípios P1–P9 — o registro completo

O `CLAUDE.md` enuncia os nove princípios em forma de regra. Este documento
guarda o porquê: a assimetria que originou cada um, as instâncias reais que os
tornaram necessários e o modo de falha que cada um impede.

A separação é P6 aplicado ao próprio repositório. A regra precisa ser lida em
toda sessão; a justificativa precisa existir, ser encontrável e não ocupar
contexto até que alguém pergunte "por quê" ou queira mudar a regra. **Mudar um
princípio exige ler este documento antes.**

Nada aqui é contrato — o contrato é `.specd/specs/` mais os deltas abertos.

---

## P1 — A CLI nunca chama LLM no caminho de decisão

**Regra.** Se um exit code depender de um modelo, ele deixa de ser
determinístico. Nenhum módulo alcançável a partir de `verify()` pode importar
cliente de LLM. Há teste de arquitetura para isso.

A regra tem duas justificativas, e a segunda cobre território que a primeira não
alcança. Determinismo protege o exit code; **irreversibilidade protege a escrita
externa.** Nenhuma declaração que decide escrita destrutiva em sistema de
terceiro pode ter sido escrita por um modelo — não porque o resultado deixaria
de ser determinístico, mas porque ele deixaria de ser desfazível.

A assimetria é o motivo. Exit code errado se roda de novo: o preço do erro é uma
execução. Card fechado com o apontamento de hora de alguém dentro não se roda de
novo — o comentário, o anexo e as horas não voltam porque o commit seguinte está
certo. Onde o erro é recuperável, determinismo basta; onde não é, a mesma
disciplina vale com força maior, e é por isso que ela se estende a operações que
exit code nenhum atravessa.

A instância concreta é um formato que ainda não existe. Um delta que declarasse
transições — `RENAMED`, `SPLIT` — colocaria a decisão de fechar o card de um
cliente na saída de quem escreve o delta, e o escritor confiável desse campo
seria `propose`. Ali o specd não estaria adivinhando: estaria obedecendo a um
palpite, o que é pior, porque parece declarado. Daí a preferência por identidade
que não precisa ser declarada — detectada e recusada (P4) em vez de declarada e
obedecida.

## P2 — Um único gate

Só `specd verify` retorna 1 por reprovação de qualidade. Outros comandos
retornam não-zero apenas por falha operacional.

CI precisa distinguir "spec reprovou" de "ferramenta quebrou". Um segundo
comando com direito a reprovar torna o exit code 1 ambíguo, e a resposta de
quem mantém o pipeline é parar de olhar para ele.

## P3 — O gate nunca acessa a rede

`explore` e `sync` acessam rede; `verify` não. Há teste de arquitetura para
isso.

Consequência de segunda ordem, aprendida em REQ-CLI-007: pergunta que só a rede
responde não é do gate — e teste que não pode conferir uma afirmação não deve
fixá-la. Ver P8, quinta instância.

## P4 — Nunca adivinhar em conflito

Âncora ambígua, conflito de merge e estado inconsistente saem com erro e
diagnóstico. Jamais auto-resolução.

## P5 — Botão de configuração só existe se dois clientes reais divergirem

Opção adicionada por hipótese vira superfície que nunca se tira, e cada uma
multiplica os estados que o gate precisa cobrir.

## P6 — Memória é efêmera; verdade durável vai para spec ou ADR

## P7 — Âncora é necessária, nunca suficiente

**Regra.** Âncora que resolve prova que existe código no caminho declarado. Não
prova que o código satisfaz o requisito. Âncora responde onde, não se nem
quando.

Daí a disciplina: âncora nunca aponta para implementação parcial. Deixar âncora
honestamente pendurada é preferível a resolvê-la para um stub — o stub troca um
sinal verdadeiro de trabalho pendente por um falso de trabalho pronto, e o gate
perde o direito de ser acreditado.

Isto é princípio e não requisito porque não é checável por máquina. Decidir se o
código satisfaz o requisito é julgamento semântico, e P1 mantém julgamento
semântico fora do caminho de decisão — não só na v1, sempre.

## P8 — Ausência de dado não é conformidade

**Regra.** Toda capacidade que lê estado externo distingue três resultados:
verificou e está certo, verificou e está errado, não conseguiu verificar. O
terceiro nunca é verde.

A regra vale nas duas direções, e a segunda demorou a aparecer porque exige
escrever em sistema de terceiro para ser vista. **Resposta de sucesso de sistema
externo não é prova de que a escrita aconteceu:** quem confirma que o estado
mudou é uma releitura, não o código de status devolvido por quem recebeu o
pedido. Toda escrita cujo efeito importa relê e confere, e falha quando o efeito
não está lá.

O modo de falha é sempre o mesmo — silêncio apresentado como aprovação — e
sempre na direção que ninguém investiga. Instâncias reais, para que a regra não
pareça abstrata:

- **Diretório sem `.specd/specs/` passava no gate.** `verify` saía 0 num
  diretório onde não havia nada para checar, então "verde" e "não achei spec"
  eram indistinguíveis, e rodar do diretório errado virava aprovação. Corrigido
  na Fatia 2 com exit 2.
- **Delta ilegível era lido como delta vazio.** O `delta.md` da Fatia 1 está no
  formato antigo; o parser novo lia zero blocos de requisito nele e `archive`
  saía 0 tendo verificado coisa nenhuma. Corrigido na Fatia 3 por REQ-FMT-009.
- **A busca de âncora enxergava zero arquivos.** Em diretório ignorado pelo
  repositório pai, `git ls-files` sucede e devolve vazio; o passo 5 da escada
  morria, `anchor suggest` emudecia, e o gate ficava verde sem dizer que a rede
  de segurança não existia. Corrigido na Fatia 4.
- **O Redmine respondeu 204 e não aplicou nada.** `PUT` com `status_id` num item
  cujo tracker não tem linha de workflow é aceito, devolve 204 e descarta o
  campo em silêncio; o mesmo `PUT` num tracker com workflow aplica. Esta é a
  instância que originou a regra de escrita. Corrigido na Fatia 6: `close` relê
  e falha quando a situação não mudou.
- **Teste verde respondendo a pergunta que expirou.** `readme.test.ts` cobrava
  a frase "não publicado" no README sem poder conferir se ela era verdade —
  estado de registry é rede, e `verify` é offline por P3. O que parecia rede era
  fecho: manteve a frase no lugar exatamente enquanto ela deixava de ser
  verdade. Não é silêncio apresentado como aprovação; é o terceiro resultado
  disfarçado do primeiro. Corrigido em REQ-CLI-007, com a regra generalizada:
  **teste que não pode conferir uma afirmação não deve fixá-la.**

Nenhuma das quatro primeiras foi descoberta por teste unitário. As quatro foram
descobertas rodando a ferramenta contra algo que ela não tinha visto antes — a
quarta contra um servidor de verdade, num teste de integração que falhou pelo
motivo errado, e cuja hipótese óbvia estava errada também.

## P9 — Operação que custa alguma coisa não acontece em silêncio

**Regra.** Custo aqui é o que o autor gostaria de ter decidido: escrita
destrutiva, escrita fora do repositório, qualquer coisa que editar um arquivo
depois não desfaz. Toda operação dessa classe ou para e nomeia a escolha, ou
deixa o resultado onde a revisão passa antes de virar história. Nenhuma decide
sozinha por ser conveniente.

O produto já era construído assim antes de a regra ter nome, e é por isso que
ela é princípio e não preferência — três instâncias independentes chegaram na
mesma forma sem se consultarem:

- `archive` reescreve as capabilities e deixa tudo fora do índice, porque o que
  ele escreveu precisa ser lido antes de virar história.
- `anchor fix` reescreve a âncora e não commita, pela mesma razão.
- `sync` recusa quando os dois lados mudaram, em vez de escolher um.

A quarta é o caso que deu nome à regra, e ainda não está construída: hoje `sync`
fecha o card de qualquer ligação órfã, sem perguntar. Renomear requisito num
delta — que a política chamava de grátis — fecha e recria card no board do
cliente, descartando comentário e apontamento de hora que alguém deixou lá. É P9
sendo violado pelo próprio produto, e é o que a fatia corrente conserta.

O modo de falha que P9 impede é vizinho do de P8 e não é o mesmo. P8 é silêncio
apresentado como aprovação: a ferramenta não conseguiu verificar e diz que está
tudo bem. P9 é ação apresentada como nada: a ferramenta fez algo que custa, e
não contou. O primeiro engana sobre o estado; o segundo engana sobre o que
acabou de acontecer — e é pior de investigar, porque não deixa nem a pergunta.

Daí a formulação que vale para além de qualquer caso particular: **o custo de
uma operação é visível no momento em que é pago.** Barato não é a propriedade
que interessa; visível é. Uma operação cara e declarada é sã; uma operação
barata e silenciosa é como se perde confiança na ferramenta uma vez só.

---

## Notas de fronteira

**O escopo faz parte do nome.** Quem instala digita `npx @jnerytech/specd
<comando>`; o nome sem escopo não foi reservado e não é deste pacote. Há teste
amarrando o nome e o caminho citados na documentação ao `name` e ao `bin` do
`package.json`.

Nenhum teste afirma estado do registry. `verify` é offline por P3, então essa
pergunta não é do gate — e a versão anterior desse parágrafo mostrou o preço: o
teste que exigia a frase "ainda não publicado" a manteve no lugar exatamente
enquanto ela deixava de ser verdade.

**Homônimo.** Existe um projeto não relacionado chamado SpecD em `@specd/cli`
(`specd-sdd/SpecD`). Não há afiliação. O único ponto de contato técnico é o nome
do binário — se ambos estiverem instalados globalmente, um sombreia o outro.

**Modelo B, o preço da refatoração.** Requisito é maleável em voo e congela ao
ser realizado. Dividir, renomear ou reescrever requisito que está num delta é
barato, e o preço é cobrado na hora (P9): renomear exige atualizar o `req` de
toda task que cita o identificador, e `coverage` reprova até que esteja feito;
com board configurado, exige também redeclarar a ligação, e `sync` recusa até
que esteja feito. O mesmo em `.specd/specs/` custa churn de identificador e
rastro de âncora, e ali nada cobra. Refatoração de requisito acontece antes do
archive, não depois — e é por isso que revisar o delta com cuidado é mais barato
que revisar a capability.

**Por que a âncora gradua por origem.** `.specd/specs/` contém só verdade
realizada; escrever requisito novo direto ali recria o estado ilegal que a
change `migracao-modelo-b` corrigiu — âncora pendurada permanente em pasta que
promete código existente. Daí pendurada em `specs/` ser erro e pendurada em
delta ser warning, e não haver consulta a "change ativa".

**Herança da Fatia 6.** `archive` ainda não chama `sync`: fechar item de board
de requisito que saiu da spec funciona, mas quem decide que ele saiu é o autor
editando o arquivo. E a interface de adaptador foi desenhada para dois
fornecedores e tem um — qualquer argumento sobre o Azure DevOps neste
repositório é dedução, não medição.
