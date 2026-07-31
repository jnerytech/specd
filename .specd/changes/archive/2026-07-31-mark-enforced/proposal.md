---
change: 2026-07-31-mark-enforced
status: active
---

# mark-enforced — o marco passa a ser cobrado

## Por quê

O `archive` cai para recorte largo quando falta `propose.json`. É o
comportamento certo e é o que torna a ausência indolor — e fallback seguro que
ninguém sente vira permanente. A saída escolhida para o marco decai sozinha para
a que foi descartada, não por decisão, por erosão.

Aconteceu na primeira change em que a regra se aplicava: `2026-07-31-usable-vacuous`
foi arquivada sem marco, e nem corrigindo dá para gravar agora — a janela dela
fechou.

## O que muda

`archive` recusa quando o marco era possível e não existe. Sem flag de dispensa:
a válvula é por onde o descuido volta, e foi a razão de descartar a recusa dura.
