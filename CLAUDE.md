# specd — instruções para agentes

## O que é

CLI de spec-driven development cujo diferencial é **detecção de drift por âncoras**: cada requisito declara onde é realizado no código, e o gate reprova quando a âncora deixa de resolver.

Pacote npm `specd`, binário `specd`, TypeScript, sem instalação (`npx specd`). Repositório público em `github.com/jnerytech/specd`.

> Existe um projeto não relacionado chamado SpecD em `@specd/cli` (`specd-sdd/SpecD`). Não há afiliação. O único ponto de contato técnico é o nome do binário — se ambos estiverem instalados globalmente, um sombreia o outro.

## Princípios invioláveis

Estes não são preferências. Violá-los destrói a proposta de valor do produto.

**P1 — A CLI nunca chama LLM no caminho de decisão.**
Se um exit code depender de um modelo, ele deixa de ser determinístico. Nenhum módulo alcançável a partir de `verify()` pode importar cliente de LLM. Há teste de arquitetura para isso.

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

**Requisito é maleável em voo e congela ao ser realizado.** Dividir, renomear ou reescrever requisito que está num delta não custa nada: ainda não há task citando o ID, nem âncora com histórico, nem código apontando. O mesmo em `.specd/specs/` custa churn de ID e rastro de âncora. Refatoração de requisito acontece antes do archive, não depois — e é por isso que revisar o delta com cuidado é mais barato que revisar a capability.

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
