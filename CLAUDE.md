# specd — instruções para agentes

CLI de spec-driven development cujo diferencial é **detecção de drift por âncoras**: cada requisito declara onde é realizado no código, e o gate reprova quando a âncora deixa de resolver.

Pacote npm `@jnerytech/specd`, binário `specd`, TypeScript. Repositório público em `github.com/jnerytech/specd`. Para rodar do clone: `npm install && npm run build`, depois `node dist/cli.js <comando>` — ou `npm link` uma vez, e aí `specd` funciona como nos exemplos.

## Princípios invioláveis

Estes não são preferências. Violá-los destrói a proposta de valor do produto. O porquê de cada um — assimetrias, instâncias reais, modos de falha — está em [`docs/principios.md`](docs/principios.md); **leia antes de propor mudança em qualquer princípio.**

- **no-llm-in-decision-path — A CLI nunca chama LLM no caminho de decisão.** Nenhum módulo alcançável a partir de `verify()` importa cliente de LLM; há teste de arquitetura. Determinismo protege o exit code, e a mesma disciplina se estende à escrita destrutiva em sistema de terceiro, que é irreversível.
- **single-gate — Um único gate.** Só `specd verify` retorna 1 por reprovação de qualidade. Outros comandos retornam não-zero apenas por falha operacional.
- **gate-no-network — O gate nunca acessa a rede.** `explore` e `sync` acessam; `verify` não. Há teste de arquitetura.
- **no-guessing-on-conflict — Nunca adivinhar em conflito.** Âncora ambígua, conflito de merge e estado inconsistente saem com erro e diagnóstico. Jamais auto-resolução.
- **config-only-on-divergence — Botão de configuração só existe se dois clientes reais divergirem.**
- **memory-is-ephemeral — Memória é efêmera; verdade durável vai para spec ou ADR.**
- **anchor-necessary-not-sufficient — Âncora é necessária, nunca suficiente.** Ela responde onde, não se nem quando. Nunca aponta para implementação parcial: âncora honestamente pendurada é preferível a resolvê-la para um stub.
- **absence-is-not-compliance — Ausência de dado não é conformidade.** Verificou-e-certo, verificou-e-errado e não-consegui-verificar são três resultados; o terceiro nunca é verde. Vale nas duas direções: resposta de sucesso de sistema externo não é prova de que a escrita aconteceu — quem confirma é a releitura.
- **costly-ops-are-not-silent — Operação que custa alguma coisa não acontece em silêncio.** Escrita destrutiva ou fora do repositório ou para e nomeia a escolha, ou deixa o resultado onde a revisão passa antes de virar história. O custo de uma operação é visível no momento em que é pago.

## Contrato de exit code

| Código | Significado                                          |
| ------ | ---------------------------------------------------- |
| 0      | Sucesso                                              |
| 1      | Gate reprovou — a spec ou o código estão errados     |
| 2      | Falha operacional — rede, I/O, configuração inválida |

CI precisa distinguir "spec reprovou" de "ferramenta quebrou".

## Onde está a especificação

`.specd/specs/` contém as capabilities realizadas — todo requisito com ID estável, statement em EARS e âncoras. `.specd/changes/` contém as changes abertas; `archive/` dentro dela guarda as encerradas.

**A spec é o contrato.** Ao implementar uma tarefa, leia os requisitos listados em `req` no frontmatter e trate os critérios de aceite como especificação de teste.

**Modelo B — o delta é a superfície de escrita.** `.specd/specs/` contém só verdade realizada. Requisito de comportamento que ainda não existe em código mora no `delta.md` de uma change aberta, com texto completo, e só entra na capability quando `specd archive` o aplica. Nunca escreva requisito novo direto em `.specd/specs/`.

**Requisito é maleável em voo e congela ao ser realizado.** Renomear ou dividir requisito num delta é barato e o preço é cobrado na hora (costly-ops-are-not-silent): `coverage` reprova até que o `req` de toda task acompanhe, e `sync` recusa até que a ligação seja redeclarada. Em `.specd/specs/` nada cobra e o custo é churn de identificador. Refatoração de requisito acontece antes do archive, não depois.

## Convenções

**Idioma.** Artefatos de infraestrutura e código em inglês. Statements EARS com keywords em inglês; prosa dos requisitos pode ser em qualquer idioma. Comentários e mensagens de erro em inglês.

**Âncoras.** Ao criar um módulo referenciado por uma âncora, respeite exatamente o caminho e o símbolo declarados. A âncora é contrato, não sugestão — se o símbolo precisar de outro nome, atualize a spec no mesmo commit.

**Testes.** Todo critério de aceite vira teste. Tarefa marcada `done` precisa de SHA em `evidence.commits`.

**Escopo.** Não implemente `propose`, `apply` nem memória — ficam fora do que está especificado hoje. `sync` e os hooks já existem; mexer neles é mudança de comportamento realizado, e passa por delta como qualquer outra.

**Este arquivo tem dois nomes.** `AGENTS.md` é symlink para `CLAUDE.md`. Edite `CLAUDE.md`; a duplicação anterior já produziu edição pela metade.

## Onde a próxima change começa

As seis primeiras changes entregaram o ciclo `explore → verify → archive` mais `sync` e hooks. Falta o meio: `propose`, que converte um bundle de exploração em delta e tarefas, e `apply`, que executa uma tarefa por vez com o verify fechando o loop. As duas restrições que a change `board-sync-redmine` deixou herdadas estão em [`docs/principios.md`](docs/principios.md).

## Validação

`npm run verify` roda format, lint, testes e build, offline e sem Docker — e a camada `project` do `specd verify` delega a ele, então o gate valida este próprio repositório.

`npm run test:integration` sobe um Redmine em container, semeia, roda a suíte de integração e derruba. É deliberadamente separado: o gate não pode exigir Docker, senão as cinco camadas offline deixam de ser offline.

## Agents do plugin feature-dev

O plugin `feature-dev@claude-plugins-official` está instalado. Use os agents dentro do ciclo do OpenSpec, nunca o comando `/feature-dev` inteiro.

| Momento                            | Agent                                            | Contenção                                                                                                                          |
| ---------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/opsx:explore`                    | 2–3 `code-explorer` em paralelo, focos distintos | Vale a regra do `.reference/README.md`: leitura pontual, nunca varredura. As ferramentas dele convidam ao contrário                |
| Antes de escrever delta            | 2 `code-architect` com focos divergentes         | Arquitetura de código, sim. Semântica do modelo de spec, não — nessas a incerteza tem que chegar ao autor, no-guessing-on-conflict |
| Antes de commit e antes de archive | 3 `code-reviewer`, um focado só nos princípios   | Corte de confiança em 80. Revisor que reporta tudo é ignorado, como gate que dói é desligado                                       |

**Não rode `/feature-dev` neste repositório.** Ele produz código sem requisito que o reivindique — a direção de drift que o specd não detecta. Ele serve para projeto que ainda não tem specd, como caminho de entrada: implementa, e depois `anchor suggest --file` transforma o escrito em requisito ancorado.
