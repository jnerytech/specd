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

## Contrato de exit code

| Código | Significado |
|---|---|
| 0 | Sucesso |
| 1 | Gate reprovou — a spec ou o código estão errados |
| 2 | Falha operacional — rede, I/O, configuração inválida |

CI precisa distinguir "spec reprovou" de "ferramenta quebrou".

## Onde está a especificação

`.specd/specs/` contém sete capabilities. Todo requisito tem ID estável, statement em EARS e âncoras.

`.specd/changes/2026-07-fatia-1/` contém o escopo atual: proposal, delta e nove tarefas.

**A spec é o contrato.** Ao implementar uma tarefa, leia os requisitos listados em `req` no frontmatter e trate os critérios de aceite como especificação de teste.

## Convenções

**Idioma.** Artefatos de infraestrutura e código em inglês. Statements EARS com keywords em inglês; prosa dos requisitos pode ser em qualquer idioma. Comentários e mensagens de erro em inglês.

**Âncoras.** Ao criar um módulo referenciado por uma âncora, respeite exatamente o caminho e o símbolo declarados. A âncora é contrato, não sugestão — se o símbolo precisar de outro nome, atualize a spec no mesmo commit.

**Testes.** Todo critério de aceite vira teste. Tarefa marcada `done` precisa de SHA em `evidence.commits`.

**Escopo.** Não implemente `propose`, `apply`, `sync`, `archive`, `anchor fix`, memória ou hooks. Estão especificados mas fora da Fatia 1.

## Ordem sugerida

**Passo 0 — humano, não agente.** Reservar `specd` no npm sem escopo antes de qualquer anúncio público; opcionalmente reservar `@jnerytech/specd`. Não é tarefa de implementação e não está em `tasks/` — ver "Primeiros passos" no README.

```
002 config → 003 parser → 004 EARS → 005 âncoras → 006 verify → 007 testes de arquitetura
001 anchor suggest  (independente, pode ir em paralelo)
008 explore         (independente do verify)
009 init e status   (depende de 002 e 006)
```

## Validação

`make verify` ou `npm run verify` deve rodar format, lint, testes e build. Quando `specd verify` existir, ele valida este próprio repositório — é o primeiro caso de teste real.
