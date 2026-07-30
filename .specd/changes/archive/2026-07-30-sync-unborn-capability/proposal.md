---
change: 2026-07-30-sync-unborn-capability
status: active
---

# sync-unborn-capability — verificar antes de gastar

## Por quê

`sync` cria os cards e só então grava as ligações na frontmatter da capability.
Sob Modelo B, requisito de change aberta mora no delta e o arquivo da capability
só nasce no `archive` — então, para capability nova, a gravação encontra um
arquivo que não existe e o comando sai 2 **depois** de já ter escrito no board.

O saldo é o pior possível: cards criados, nenhuma ligação registrada, e a
próxima tentativa criando tudo de novo, porque ausência de ligação é lida como
"nunca sincronizado". Gastar primeiro e verificar depois é a ordem invertida de
costly-ops-are-not-silent.

A change `2026-07-29-cycle-skills` criou duas capabilities do zero. Ela não bateu
nisto porque este repositório não configura board; em qualquer repositório que
configure, o passo de sincronizar a proposta teria falhado assim.

## O que muda

`sync` recusa antes da primeira escrita quando um item planejado pertence a
capability que não tem arquivo em `.specd/specs/`. A recusa não precisa de rede,
então acontece no ponto mais cedo possível — e vale igual no `--dry-run`, porque
plano que não menciona o impedimento é plano que mente.

## O que esta change não é

Não é o conserto. O conserto é fazer a ligação viajar com o bloco do requisito e
migrar no `archive` — que continua aberto, e que a pendência de "ligação viajando
com o bloco" já pedia por outras duas razões.

Esta é a parte que vai sozinha e primeiro: enquanto o conserto não existe,
ninguém paga card órfão nem duplicação por tentar. Migrar bloco, tocar em
`archive` ou mexer na leitura e escrita das ligações está fora do escopo.
