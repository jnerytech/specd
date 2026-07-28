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

## Contrato de exit code

| Código | Significado                                          |
| ------ | ---------------------------------------------------- |
| 0      | Sucesso                                              |
| 1      | Gate reprovou — a spec ou o código estão errados     |
| 2      | Falha operacional — rede, I/O, configuração inválida |

CI precisa distinguir "spec reprovou" de "ferramenta quebrou".

## Onde está a especificação

`.specd/specs/` contém sete capabilities. Todo requisito tem ID estável, statement em EARS e âncoras.

`.specd/changes/` contém as changes abertas. A Fatia 1 está encerrada e espera o comando `archive`; a Fatia 2 é o escopo corrente; a Fatia 3 existe para segurar REQ-VER-003, que nenhuma outra change implementa.

**A spec é o contrato.** Ao implementar uma tarefa, leia os requisitos listados em `req` no frontmatter e trate os critérios de aceite como especificação de teste.

**Modelo B — o delta é a superfície de escrita.** `.specd/specs/` contém só verdade realizada. Requisito de comportamento que ainda não existe em código mora no `delta.md` de uma change aberta, com texto completo, e só entra na capability quando `specd archive` o aplica. Escrever requisito novo direto em `.specd/specs/` recria o estado ilegal que a change `migracao-modelo-b` corrigiu: âncora pendurada permanente em pasta que promete código existente.

Daí a política de âncora graduar por origem — pendurada em `specs/` é erro, pendurada em delta é warning — e não por consulta a "change ativa".

## Convenções

**Idioma.** Artefatos de infraestrutura e código em inglês. Statements EARS com keywords em inglês; prosa dos requisitos pode ser em qualquer idioma. Comentários e mensagens de erro em inglês.

**Âncoras.** Ao criar um módulo referenciado por uma âncora, respeite exatamente o caminho e o símbolo declarados. A âncora é contrato, não sugestão — se o símbolo precisar de outro nome, atualize a spec no mesmo commit.

**Testes.** Todo critério de aceite vira teste. Tarefa marcada `done` precisa de SHA em `evidence.commits`.

**Escopo.** Não implemente `propose`, `apply`, `sync`, memória, hooks nem a camada `provenance`. Estão especificados ou previstos e ficam fora da Fatia 2.

## Ordem sugerida — Fatia 2

**Passo 0 — humano, não agente.** Reservar `specd` no npm sem escopo antes de qualquer anúncio público; opcionalmente reservar `@jnerytech/specd`. Não é tarefa de implementação e não está em `tasks/` — ver "Primeiros passos" no README.

```
readOpenChanges + exclusão de archive/ + passagem vazia
      ├── parseDelta ──┬── coverage
      │                └── archive
      └── parseTask  ──┴── evidence
                          anchor fix  (independente, cauda opcional)
                          status      (depende dos anteriores)
```

Os três primeiros vêm antes porque `coverage`, `evidence` e `archive` precisam saber de qual change estão falando, e `readActiveChange` hoje devolve a mais antiga.

## Validação

`make verify` ou `npm run verify` deve rodar format, lint, testes e build. Quando `specd verify` existir, ele valida este próprio repositório — é o primeiro caso de teste real.
