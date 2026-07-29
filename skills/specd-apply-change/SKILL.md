---
name: specd-apply-change
description: Implementa as tasks de uma change aberta do specd até as âncoras do delta resolverem, atualiza o delta com o que a execução descobrir e roda `specd verify` reportando o veredito. Use quando o usuário quiser começar a implementar, continuar de onde parou, ou fechar as tasks pendentes de uma change.
requires_specd: ">=0.3.0"
---

# specd-apply-change

Terceiro passo do ciclo. Implementa até o gate fechar. **Não arquiva, não
escreve no board e não promove requisito para `.specd/specs/`.**

## Antes de qualquer coisa

```bash
specd --version
```

Menor que `requires_specd` → **pare**.

## 1. Escolher a change e a task

```bash
specd status --json
```

Uma change aberta: use essa. Mais de uma: **pergunte pela ferramenta de pergunta
do host** com as changes como opções. Nunca infira por data nem por ordem.

Dentro da change, as tasks estão em `tasks/*.md` com `status` na frontmatter:
`pending | in_progress | done | blocked`.

## 2. Ler o contrato

```bash
specd spec --json
```

Os requisitos que a task cita em `req` são a especificação. Os critérios de
aceite **são** a especificação de teste — cada um vira teste.

Nunca reconstrua o overlay lendo `.specd/specs/` e os deltas soltos: a spec
que a skill leria não seria a que o gate lê, e ninguém veria a diferença.

## 3. Implementar

Até as âncoras declaradas no delta resolverem. A âncora é contrato, não
sugestão: respeite exatamente o caminho e o símbolo declarados. Se o símbolo
precisar de outro nome, **atualize o delta no mesmo commit** — requisito em voo
é maleável e o preço é cobrado na hora.

Escreva código no idioma e no estilo do repositório em volta: mesma densidade de
comentário, mesmos nomes, mesmos idiomas.

## 4. Atualizar a spec com o que a execução descobriu

"A spec" aqui é o **delta**, nunca `.specd/specs/`. Requisito que faltava,
âncora que devia apontar para outro símbolo, premissa que não se sustentou:
tudo entra no `delta.md` da change corrente.

É para isso que o delta é a superfície de escrita — o ciclo precisa de um lugar
onde a realidade corrige a intenção sem contaminar a verdade realizada.

Mexeu em requisito? Confira se o `req` das tasks acompanha, ou `coverage`
reprova.

## 5. Rodar o gate

```bash
specd verify
```

Reporte o que ele disse, sem interpretar. O veredito é dele: a skill prepara
material e lê resultado, nunca emite verdict. Não invente um segundo portão com
"acho que isso não está pronto".

Exit 1 é a spec ou o código errados. Exit 2 é a ferramenta quebrada — rede,
I/O, configuração. Os dois têm tratamento diferente e nunca são reportados como
a mesma coisa.

## 6. Fechar a task

Task `done` exige SHA em `evidence.commits`, ou a camada `evidence` reprova.
Commite o trabalho, preencha a evidência, siga para a próxima.

**Armadilha:** âncora resolvendo não é conclusão
(`anchor-necessary-not-sufficient`). O símbolo existir no lugar declarado é
condição necessária e nada mais — o comportamento ainda precisa estar certo, e
isso o gate não sabe checar sozinho.

## Quando parar e perguntar

Use a ferramenta de pergunta do host, com opções, sempre que:

- o requisito é ambíguo o bastante para duas implementações incompatíveis
- implementar revela que a proposta estava errada em algo que muda escopo
- a âncora declarada não tem lugar honesto no código
- o gate reprova por algo fora da task corrente

Âncora honestamente pendurada é preferível a resolvê-la para um stub. Nunca
aponte âncora para implementação parcial.
