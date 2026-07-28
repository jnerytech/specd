# docs/history — não-normativo

**Nada nesta pasta é contrato.**

O contrato do specd é `.specd/specs/` mais o `delta.md` das changes abertas em
`.specd/changes/`, e nada além disso. Um identificador que não aparece nesses
dois lugares não obriga este repositório, seja qual for o documento que o cite.

## Por que a pasta existe

A proposta original do produto usa identificadores com prefixo `REQ-` que **não
correspondem** aos de `.specd/specs/`. Ela usa `REQ-SPEC-*`, `REQ-BOARD-*`,
`REQ-MEM-*` e `REQ-SEC-*`; o repositório usa `REQ-ANC-*`, `REQ-CFG-*`,
`REQ-CLI-*`, `REQ-EARS-*`, `REQ-EXP-*`, `REQ-FMT-*`, `REQ-VER-*` e `REQ-ARC-*`.

A colisão de prefixo já produziu quatro citações de requisitos inexistentes
durante o desenvolvimento da Fatia 1 e do Modelo B. Versionar o documento aqui,
marcado, é mais barato que continuar descobrindo a divergência uma citação por
vez.

## Banner obrigatório

Todo arquivo desta pasta abre com:

```markdown
> **HISTÓRICO — NÃO-NORMATIVO.** Este documento registra o desenho original e
> não é contrato. Os identificadores `REQ-` abaixo são históricos e **não**
> correspondem aos de `.specd/specs/`. Para o contrato vigente, ver
> `.specd/specs/` e os deltas em `.specd/changes/`.
```

O conteúdo abaixo do banner é preservado como está. Não se reescreve documento
histórico: reescrever apaga a evidência de qual decisão foi tomada quando.

## O que ainda não tem capability

Enumerado no proposal de `migracao-modelo-b` com prefixo `BL-`, deliberadamente
fora do espaço `REQ-`, para que citação futura não passe por contrato:
`BL-BOARD-01`, `BL-MEM-01`, `BL-SEC-01`, `BL-EXEC-01`.

## Conteúdo

_(vazio — o documento de proposta original ainda não foi fornecido)_
