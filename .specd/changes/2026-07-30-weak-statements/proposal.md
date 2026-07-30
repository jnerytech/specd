---
change: 2026-07-30-weak-statements
status: active
---

# weak-statements — os seis que entraram abaixo do padrão

## Por quê

Seis requisitos foram promovidos a `origin: specs` com defeito de enunciado
conhecido no momento da promoção, e o commit que os promoveu registra isso. As
duas janelas de revisão que existem hoje nasceram desses defeitos; esta change é
o conserto deles.

## O que ela é

O primeiro uso real de REQ-SKL-007 e REQ-SKL-008. Escrita nova, com as skills em
vigor, e toda em `MODIFIED` — as três perguntas do propose incidem sobre cada
reescrita.

## O que ela não é

Teste independente dos critérios. Estes seis foram o conjunto que desenhou as
três perguntas; revisá-los com os critérios que eles próprios geraram prova que
os critérios são aplicáveis, não que um revisor cego chegaria neles. O primeiro
teste cego é a change seguinte a esta.

Vender isto como validação seria a mesma forma do teste que passava porque a
fixture não declarava `[[board.fields]]`: a premissa verificando a si mesma.
