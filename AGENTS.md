# specd — instruções para agentes

## O que é

CLI de spec-driven development cujo diferencial é **detecção de drift por âncoras**: cada requisito declara onde é realizado no código, e o gate reprova quando a âncora deixa de resolver.

Pacote npm `specd`, binário `specd`, TypeScript. Repositório público em `github.com/jnerytech/specd`.

**Ainda não publicado no registry**, então `npx specd` responde 404. Até a primeira publicação, roda-se do clone: `npm install && npm run build`, depois `node dist/cli.js <comando>` — ou `npm link` uma vez, e aí `specd` funciona como nos exemplos. Está no README, e há teste amarrando o caminho citado ao `bin` do `package.json`.

> Existe um projeto não relacionado chamado SpecD em `@specd/cli` (`specd-sdd/SpecD`). Não há afiliação. O único ponto de contato técnico é o nome do binário — se ambos estiverem instalados globalmente, um sombreia o outro.

## Princípios invioláveis

Estes não são preferências. Violá-los destrói a proposta de valor do produto.

**P1 — A CLI nunca chama LLM no caminho de decisão.**
Se um exit code depender de um modelo, ele deixa de ser determinístico. Nenhum módulo alcançável a partir de `verify()` pode importar cliente de LLM. Há teste de arquitetura para isso.

A regra tem duas justificativas, e a segunda cobre território que a primeira não alcança. Determinismo protege o exit code; **irreversibilidade protege a escrita externa.** Nenhuma declaração que decide escrita destrutiva em sistema de terceiro pode ter sido escrita por um modelo — não porque o resultado deixaria de ser determinístico, mas porque ele deixaria de ser desfazível.

A assimetria é o motivo. Exit code errado se roda de novo: o preço do erro é uma execução. Card fechado com o apontamento de hora de alguém dentro não se roda de novo — o comentário, o anexo e as horas não voltam porque o commit seguinte está certo. Onde o erro é recuperável, determinismo basta; onde não é, a mesma disciplina vale com força maior, e é por isso que ela se estende a operações que exit code nenhum atravessa.

A instância concreta é um formato que ainda não existe. Um delta que declarasse transições — `RENAMED`, `SPLIT` — colocaria a decisão de fechar o card de um cliente na saída de quem escreve o delta, e o escritor confiável desse campo seria `propose`. Ali o specd não estaria adivinhando: estaria obedecendo a um palpite, o que é pior, porque parece declarado. Daí a preferência por identidade que não precisa ser declarada — detectada e recusada (P4) em vez de declarada e obedecida.

**P2 — Um único gate.**
Só `specd verify` retorna 1 por reprovação de qualidade. Outros comandos retornam não-zero apenas por falha operacional.

**P3 — O gate nunca acessa a rede.**
`explore` e `sync` acessam rede; `verify` não. Há teste de arquitetura para isso.

**P4 — Nunca adivinhar em conflito.**
Âncora ambígua, conflito de merge e estado inconsistente saem com erro e diagnóstico. Jamais auto-resolução.

**P5 — Botão de configuração só existe se dois clientes reais divergirem.**

**P6 — Memória é efêmera; verdade durável vai para spec ou ADR.**

**P7 — Âncora é necessária, nunca suficiente.**
Âncora que resolve prova que existe código no caminho declarado. Não prova que o código satisfaz o requisito. Âncora responde onde, não se nem quando.

Daí a disciplina: âncora nunca aponta para implementação parcial. Deixar âncora honestamente pendurada é preferível a resolvê-la para um stub — o stub troca um sinal verdadeiro de trabalho pendente por um falso de trabalho pronto, e o gate perde o direito de ser acreditado.

Isto é princípio e não requisito porque não é checável por máquina. Decidir se o código satisfaz o requisito é julgamento semântico, e P1 mantém julgamento semântico fora do caminho de decisão — não só na v1, sempre.

**P8 — Ausência de dado não é conformidade.**
Toda capacidade que lê estado externo distingue três resultados: verificou e está certo, verificou e está errado, não conseguiu verificar. O terceiro nunca é verde.

A regra vale nas duas direções, e a segunda demorou a aparecer porque exige escrever em sistema de terceiro para ser vista. **Resposta de sucesso de sistema externo não é prova de que a escrita aconteceu:** quem confirma que o estado mudou é uma releitura, não o código de status devolvido por quem recebeu o pedido. Toda escrita cujo efeito importa relê e confere, e falha quando o efeito não está lá.

O modo de falha é sempre o mesmo — silêncio apresentado como aprovação — e sempre na direção que ninguém investiga. Quatro instâncias reais, para que a regra não pareça abstrata:

- **Diretório sem `.specd/specs/` passava no gate.** `verify` saía 0 num diretório onde não havia nada para checar, então "verde" e "não achei spec" eram indistinguíveis, e rodar do diretório errado virava aprovação. Corrigido na Fatia 2 com exit 2.
- **Delta ilegível era lido como delta vazio.** O `delta.md` da Fatia 1 está no formato antigo; o parser novo lia zero blocos de requisito nele e `archive` saía 0 tendo verificado coisa nenhuma. Corrigido na Fatia 3 por REQ-FMT-009.
- **A busca de âncora enxergava zero arquivos.** Em diretório ignorado pelo repositório pai, `git ls-files` sucede e devolve vazio; o passo 5 da escada morria, `anchor suggest` emudecia, e o gate ficava verde sem dizer que a rede de segurança não existia. Corrigido na Fatia 4.
- **O Redmine respondeu 204 e não aplicou nada.** `PUT` com `status_id` num item cujo tracker não tem linha de workflow é aceito, devolve 204 e descarta o campo em silêncio; o mesmo `PUT` num tracker com workflow aplica. Esta é a instância que originou a regra de escrita. Corrigido na Fatia 6: `close` relê e falha quando a situação não mudou.

Nenhuma das quatro foi descoberta por teste unitário. As quatro foram descobertas rodando a ferramenta contra algo que ela não tinha visto antes — a quarta contra um servidor de verdade, num teste de integração que falhou pelo motivo errado, e cuja hipótese óbvia estava errada também.

**P9 — Operação que custa alguma coisa não acontece em silêncio.**
Custo aqui é o que o autor gostaria de ter decidido: escrita destrutiva, escrita fora do repositório, qualquer coisa que editar um arquivo depois não desfaz. Toda operação dessa classe ou para e nomeia a escolha, ou deixa o resultado onde a revisão passa antes de virar história. Nenhuma decide sozinha por ser conveniente.

O produto já era construído assim antes de a regra ter nome, e é por isso que ela é princípio e não preferência — três instâncias independentes chegaram na mesma forma sem se consultarem:

- `archive` reescreve as capabilities e deixa tudo fora do índice, porque o que ele escreveu precisa ser lido antes de virar história.
- `anchor fix` reescreve a âncora e não commita, pela mesma razão.
- `sync` recusa quando os dois lados mudaram, em vez de escolher um.

A quarta é o caso que deu nome à regra, e ainda não está construída: hoje `sync` fecha o card de qualquer ligação órfã, sem perguntar. Renomear requisito num delta — que a política chamava de grátis — fecha e recria card no board do cliente, descartando comentário e apontamento de hora que alguém deixou lá. É P9 sendo violado pelo próprio produto, e é o que a fatia corrente conserta.

O modo de falha que P9 impede é vizinho do de P8 e não é o mesmo. P8 é silêncio apresentado como aprovação: a ferramenta não conseguiu verificar e diz que está tudo bem. P9 é ação apresentada como nada: a ferramenta fez algo que custa, e não contou. O primeiro engana sobre o estado; o segundo engana sobre o que acabou de acontecer — e é pior de investigar, porque não deixa nem a pergunta.

Daí a formulação que vale para além de qualquer caso particular: **o custo de uma operação é visível no momento em que é pago.** Barato não é a propriedade que interessa; visível é. Uma operação cara e declarada é sã; uma operação barata e silenciosa é como se perde confiança na ferramenta uma vez só.

## Contrato de exit code

| Código | Significado                                          |
| ------ | ---------------------------------------------------- |
| 0      | Sucesso                                              |
| 1      | Gate reprovou — a spec ou o código estão errados     |
| 2      | Falha operacional — rede, I/O, configuração inválida |

CI precisa distinguir "spec reprovou" de "ferramenta quebrou".

## Onde está a especificação

`.specd/specs/` contém as capabilities realizadas. Todo requisito tem ID estável, statement em EARS e âncoras.

`.specd/changes/` contém as changes abertas; `archive/` dentro dela guarda as encerradas. As Fatias 1 a 6 estão arquivadas.

**A spec é o contrato.** Ao implementar uma tarefa, leia os requisitos listados em `req` no frontmatter e trate os critérios de aceite como especificação de teste.

**Modelo B — o delta é a superfície de escrita.** `.specd/specs/` contém só verdade realizada. Requisito de comportamento que ainda não existe em código mora no `delta.md` de uma change aberta, com texto completo, e só entra na capability quando `specd archive` o aplica. Escrever requisito novo direto em `.specd/specs/` recria o estado ilegal que a change `migracao-modelo-b` corrigiu: âncora pendurada permanente em pasta que promete código existente.

Daí a política de âncora graduar por origem — pendurada em `specs/` é erro, pendurada em delta é warning — e não por consulta a "change ativa".

**Requisito é maleável em voo e congela ao ser realizado.** Dividir, renomear ou reescrever requisito que está num delta é barato, e o preço é cobrado na hora (P9): renomear exige atualizar o `req` de toda task que cita o identificador, e `coverage` reprova até que esteja feito; com board configurado, exige também redeclarar a ligação, e `sync` recusa até que esteja feito. O mesmo em `.specd/specs/` custa churn de identificador e rastro de âncora, e ali nada cobra. Refatoração de requisito acontece antes do archive, não depois — e é por isso que revisar o delta com cuidado é mais barato que revisar a capability.

## Convenções

**Idioma.** Artefatos de infraestrutura e código em inglês. Statements EARS com keywords em inglês; prosa dos requisitos pode ser em qualquer idioma. Comentários e mensagens de erro em inglês.

**Âncoras.** Ao criar um módulo referenciado por uma âncora, respeite exatamente o caminho e o símbolo declarados. A âncora é contrato, não sugestão — se o símbolo precisar de outro nome, atualize a spec no mesmo commit.

**Testes.** Todo critério de aceite vira teste. Tarefa marcada `done` precisa de SHA em `evidence.commits`.

**Escopo.** Não implemente `propose`, `apply` nem memória. Ficam fora do que está especificado hoje. `sync` e os hooks já existem — mexer neles é mudança de comportamento realizado, e passa por delta como qualquer outra.

## Onde a próxima fatia começa

Seis fatias entregaram o ciclo `explore → verify → archive` mais `sync` e hooks. O que falta do ciclo original é o meio: `propose`, que converte um bundle de exploração em delta e tarefas, e `apply`, que executa uma tarefa por vez com o verify fechando o loop.

Duas restrições que a Fatia 6 deixou herdadas e que valem para os dois:

- `archive` ainda não chama `sync`. Fechar item de board de requisito que saiu da spec funciona, mas quem decide que ele saiu é o autor editando o arquivo.
- A interface de adaptador foi desenhada para dois fornecedores e tem um. Qualquer argumento sobre o Azure DevOps neste repositório é dedução, não medição.

## Validação

`npm run verify` roda format, lint, testes e build, offline e sem Docker — e a camada `project` do `specd verify` delega a ele, então o gate valida este próprio repositório.

`npm run test:integration` sobe um Redmine em container, semeia, roda a suíte de integração e derruba. Ele é deliberadamente separado: o gate não pode exigir Docker, senão as cinco camadas offline deixam de ser offline.
