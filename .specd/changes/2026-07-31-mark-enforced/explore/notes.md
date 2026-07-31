# Exploração — mark-enforced

## Origem do escopo

Sem board neste repositório. O escopo veio do registro de 2026-07-31 em
`sandbox/RELATORIO.md` — a saída 4 do marco decaindo para a 3 — e da decisão do
autor: forma 4, recusa condicional, sem flag de dispensa.

## Escopo

`archive` recusa quando o marco era possível e não existe.

## Não-escopo

- Saída A do achado 1, lista de skills em três lugares, ponto cego do ciclo,
  defeito irmão do `usable` no modo sem board
- Qualquer mudança no recorte de REQ-SKL-008, que continua lendo o registro
- Flag de dispensa, em qualquer forma

## Duas verificações que mudam o quadro

**Nenhuma change existente encalha.** `specd status` diz que não há change aberta,
e `.specd/changes/` só tem `archive/`. Toda change anterior ao mecanismo já foi
arquivada, inclusive a `usable-vacuous` em `86d5aa6`. A coluna "changes já
perdidas" está vazia daqui para frente.

**O predicado já existe e não precisa de irmão.** Em `src/spec/record.ts`, a
guarda do `propose-record` distingue os dois casos pela mesma pergunta que a
cobrança do archive precisa fazer:

```
declared = delta.added ++ delta.modified
tasks.length === 0 && declared.length > 0  →  recusa
delta só REMOVED                           →  grava registro vazio
```

A forma 4 é essa condição na outra ponta: no archive, `declared.length > 0` e
nenhum registro → o marco era possível e alguém pulou o passo.

## O furo: change só-`REMOVED` que ganha requisito no apply

O passo 4 da `specd-apply-change` autoriza escrever no delta o que a execução
descobriu. O percurso:

1. change abre declarando só `REMOVED` — não precisa de marco, não precisa de task
2. uma task fecha; a janela do `propose-record` fecha junto
3. durante o apply nasce um `ADDED`
4. no archive ela declara requisito, não tem marco, e não pode mais gravar um

Encalha sem saída. É o único caso que a forma 4 quebra de verdade.

## As saídas, medidas

### a) O archive recusa, e a saída é reabrir a change de outro jeito

Custo: não existe "reabrir de outro jeito" hoje. A recuperação seria manual —
apagar tasks para reabrir a janela, ou editar o delta para tirar o requisito
novo. As duas são desfazer trabalho para satisfazer uma guarda, que é o inverso
do que a guarda existe para proteger.

### b) A condição olha o que o delta declarava quando a janela fechou

É o que o mecanismo quer dizer: o marco era possível se, **naquele momento**, a
change declarava requisito.

Medido: **exige peça nova, e a peça não tem onde morar.** Nada observa o
fechamento da janela — ele acontece quando alguém edita `status:` num arquivo de
task, e nenhum comando roda nesse instante. Gravar o estado do delta ali exigiria
um gancho que não existe, ou um comando que ninguém tem razão de rodar naquele
momento.

Sem esse registro, "o que o delta declarava quando a janela fechou" não é
recuperável — a mesma indatabilidade que criou o defeito original, um nível
abaixo.

### c) O `propose-record` volta a ser permitido quando o delta ganha requisito novo

Custo: a condição é indistinguível do abuso. "Não há registro e o delta declara
requisito" descreve tanto a change só-`REMOVED` que cresceu quanto a change que
simplesmente pulou o passo — que é exatamente o que a cobrança quer pegar. E o
registro gravado tarde conteria estado pós-apply, que é o defeito de ontem
voltando pela porta da recuperação.

### d) Toda change grava marco, inclusive vazio

O comando já faz isso: change só-`REMOVED` sem task grava `requirements: []`. O
que muda é a skill deixar de tratar isso como caso especial — roda sempre, no
passo 5, e toda change nasce com marco.

O furo fecha por não existir: a change do percurso acima teria `propose.json`
vazio desde a abertura. O requisito que nasce no apply fica **ausente do
registro**, que é a segunda entrada do recorte de REQ-SKL-008 — ele entra na
revisão em vez de encalhar o archive.

E a cobrança do archive fica mais simples do que a forma 4 pedia: não é "o marco
era possível", é "não há marco". Sem predicado composto, sem exceção para
só-`REMOVED`, sem consultar o que o delta declara.

Custo: registro vazio existe em disco para change que não tem o que registrar —
um arquivo com lista vazia, que é ruído pequeno e declarado. E a regra passa a
depender de a skill rodar o comando **sempre**, não só quando há requisito, o que
é uma linha a mais de instrução e uma condição a menos.

## O que cada uma faz com a change que legitimamente não tem marco

Sob (d) essa categoria deixa de existir: se toda change grava, a ausência de
registro só acontece quando alguém pulou o passo. Sob (a), (b) e (c) a categoria
persiste e cada uma a trata de um jeito — nenhum deles sem custo.

## Um defeito que a exploração não conserta

`propose-record` grava registro vazio para change só-`REMOVED`, e um registro
vazio é indistinguível de "gravei antes de o delta ter requisito". Sob (d) isso
não importa, porque o requisito que nascer depois entra pela segunda entrada do
recorte. Sob as outras, importa. Registrado em `sandbox/RELATORIO.md`.

## Perguntas em aberto

Uma: qual das quatro. O delta espera, e o `propose-record` roda no passo 5 desta
change assim que ele existir.
