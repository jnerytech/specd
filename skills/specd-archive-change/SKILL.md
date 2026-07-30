---
name: specd-archive-change
description: Encerra uma change do specd — confere gate verde, anuncia a escrita, aplica o delta em `.specd/specs/` com `specd archive` e, havendo board, sincroniza e transiciona os itens da change. Use quando o usuário quiser finalizar, arquivar ou encerrar uma change já implementada.
requires_specd: ">=0.3.0"
---

# specd-archive-change

Último passo do ciclo. Aplica o delta na verdade realizada e move a change.
**Não implementa e não conserta gate vermelho.**

## Antes de qualquer coisa

```bash
specd --version
```

Menor que `requires_specd` → **pare**.

## O que este passo significa

Arquivar promove os requisitos do delta de `origin: delta` para
`origin: specs`. A partir daí, âncora quebrada neles é **erro**, não warning.

É uma promoção de rigor: arquivar é assumir dívida de manutenção sobre cada
âncora promovida. É o momento mais caro do ciclo, e o que mais merece cerimônia.

## 1. Pré-condições duras

```bash
specd verify
```

Verde, sem exceção. Gate vermelho volta para `specd-apply-change` — esta skill
não conserta nada.

Toda task da change precisa estar `done` com SHA em `evidence.commits`. É
pré-condição dura, não pergunta: task aberta significa trabalho que a change
declarou e não entregou, e arquivar promove o requisito dela a verdade
realizada mesmo assim.

O CLI não impõe isso — `archive` não olha o status das tasks. A regra vive aqui,
o que quer dizer que ela pode ser esquecida; enquanto for assim, esta skill é o
único lugar que a cobra.

Não existe arquivamento provisório, nem arquivamento que deixa o board para
depois.

### Rever o que mudou desde o propose

Uma pergunta só, e sobre um recorte estreito: **a âncora realiza o que o
statement afirma?**

Entram na revisão:

- requisito cujo texto foi reescrito durante o apply
- **requisito que não existia no propose** — o passo 4 desta mesma família manda
  escrever no delta o que a execução descobriu, e esse requisito não passou pela
  revisão do propose; é o caminho mais provável de enunciado ruim, escrito sob
  pressão de implementação
- âncora que passou de pendurada a resolvida — mesmo com a declaração
  inalterada, porque o que mudou foi o símbolo passar a existir

Fica de fora o requisito que não mudou e cuja âncora já resolvia no propose.
Reler o delta inteiro aqui é revisão que alguém pula, e revisão pulada é pior
que revisão ausente: parece existir.

Âncora que resolve para símbolo que **não** realiza o comportamento enunciado é
o achado que esta revisão existe para pegar. Ela resolve para sempre, o gate
nunca reclama, e o requisito passa a afirmar verificação que ninguém faz —
pior que âncora ausente, que ao menos aparece no `coverage` e no
`anchor suggest`.

Achado aqui **para o arquivamento** e vira pergunta ao autor pela ferramenta do
host. A skill não reescreve âncora por conta própria. Trocar âncora depois do
archive é churn de identificador em requisito promovido; trocar antes custa uma
linha de delta.

## 2. Anunciar antes de escrever

Diga, antes de rodar qualquer coisa:

- quais requisitos entram em quais capabilities
- quais identificadores são aposentados, se houver `REMOVED`
- se o board vai ser tocado, e o que vai acontecer com cada item

Peça confirmação explícita pela ferramenta de pergunta do host. Escrita
destrutiva ou fora do repositório para e nomeia a escolha
(`costly-ops-are-not-silent`).

## 3. Arquivar

Sem board:

```bash
specd archive <nome-da-change>
```

Com board:

```bash
specd archive <nome-da-change> --sync
```

`--sync` reconcilia o conteúdo e depois move os itens da change para
`[board.mapping] archived_status`. Sem esse status configurado nenhuma transição
é tentada, e a saída diz isso — leia e repasse, porque silêncio ali seria lido
como "os itens moveram".

Ordem escolhida: spec primeiro, board depois. Spec adiante do board se resolve
com `specd sync`, que é idempotente; board adiante da spec deixa card para
requisito que o repositório não reconhece.

Se o sync falhar depois de a spec avançar, **nada é desfeito** — a mensagem diz
que a spec andou e o board não, e manda rodar `specd sync`. Não tente reverter o
archive.

## 4. Relatar a divergência

O que foi realizado pode divergir do que foi proposto. Nesse caso a verdade é o
delta atual, não o que foi prometido em `propose`. A divergência é informação
boa: vai explícita para o board e para o resumo final.

## 5. Conferir

```bash
specd verify
specd status
```

Nada foi commitado nem staged: o diff é para ser lido antes de virar história.

## Quando parar e perguntar

Use a ferramenta de pergunta do host, com opções, sempre que:

- o delta contradiz o que está em `.specd/specs/`
- o board está configurado e inalcançável — **pare**; não arquive "só
  localmente por enquanto" sem que isso seja uma decisão declarada do autor
- existe change arquivada com o mesmo nome

Board configurado e inalcançável é falha, não ausência. Cair para o modo sem
board transformaria "não consegui verificar" em "verifiquei e está tudo certo".
