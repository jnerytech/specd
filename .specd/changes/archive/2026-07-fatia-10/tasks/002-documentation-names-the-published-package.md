---
id: "002-documentation-names-the-published-package"
change: 2026-07-fatia-10
req: [REQ-CLI-007]
status: done
evidence:
  commits: ["8cb4633"]
---

## Objetivo

Trocar o teste que fixava uma afirmação sobre o registry por um que amarra a documentação ao `name` do manifesto, e corrigir a documentação que ele passa a cobrar.

## Escopo

`test/distribution/readme.test.ts` perde os casos que exigem `/não está publicado|não publicado/` no README e no CLAUDE.md, e ganha o caso que compara o nome de pacote citado nos dois com `manifest.name`. O acoplamento com `bin` que já existe fica como está — ele sempre foi o pedaço certo.

README.md e CLAUDE.md passam a nomear `@jnerytech/specd`. Onde hoje se lê `npx specd`, passa a ser `npx @jnerytech/specd`, que funciona. A seção "Reservar o nome no npm" do README descreve um passo já executado com outro nome e é reescrita como o que é: o pacote está publicado sob escopo, o nome sem escopo continua livre, e reservá-lo é decisão em aberto.

## Restrições

- **A ordem é teste primeiro.** Escrever a asserção nova antes de editar a prosa faz a suíte ficar vermelha pelo motivo certo e por um instante, que é a única prova de que ela cobre alguma coisa. Corrigir a prosa antes deixaria impossível distinguir teste que pega de teste que passa por acaso
- Nenhuma asserção nova sobre estado do registry, em nenhuma redação. É a regra do requisito aplicada à task que a implementa: `verify` é offline por P3, então essa pergunta não é do gate
- `readme.test.ts:57-61` também cobra `/não publicado/` no CLAUDE.md e no AGENTS.md. Os três casos caem juntos; deixar um de pé recria o fecho num arquivo só
- CLAUDE.md e AGENTS.md são o mesmo texto em dois arquivos. Editar os dois, ou o teste pega o esquecido
- A prosa sobre `npx specd` sem escopo não some sem substituto. Ela existe porque quem digita o nome óbvio recebe 404, e isso continua verdade — muda de "ainda não publicamos" para "esse nome não é nosso"
- Não reabrir a decisão de escopo. Renomear pacote publicado tem custo próprio e não é desta fatia; o README pode registrar a opção sem tomá-la
- `test/distribution/package.test.ts:89` já afirma `name === "@jnerytech/specd"` e continua valendo sem edição. É a asserção que estava certa o tempo todo, do lado da que estava travando o oposto

## Critérios de aceite

- Nenhum teste da suíte casa contra texto que afirme estado de publicação
- Teste falha se `manifest.name` mudar e README ou CLAUDE.md não acompanharem
- Teste falha se `bin` mudar e o README não acompanhar, como antes
- README e CLAUDE.md nomeiam `@jnerytech/specd`; nenhum dos dois afirma que o pacote não está publicado
- Nenhuma linha de comando copiável do README responde 404
- A afirmação de que `specd` sem escopo é 404 continua no README, agora pelo motivo verdadeiro
- `npm run verify` passa
