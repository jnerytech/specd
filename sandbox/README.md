# sandbox — experimentação manual

**Esta pasta é ignorada pelo git.** Só este README é versionado. O conteúdo
é descartável: pode ser apagado e rebaixado a qualquer momento sem perda.

## O que foi baixado

| Pasta       | Origem                                                                 | Stack     | Observação                                                |
| ----------- | ---------------------------------------------------------------------- | --------- | --------------------------------------------------------- |
| `sample05/` | eximiaco/csharp_jeito_certo — Masterclass/engenharia_projetos/sample05 | C# / .NET | Sem LICENSE declarada. Não copiar código dele para `src/` |

## Para que serve

Exercitar o specd numa stack que não é TypeScript. Rodar `specd init` aqui,
verificar a detecção de stack e testar a resolução de âncoras contra código
C# real — arquivos, namespaces e símbolos que ninguém escreveu pensando na
nossa ferramenta.

Um projeto que só funciona no próprio repositório não prova nada.

## Se virar caso de regressão

Comportamento interessante descoberto aqui não fica aqui. Deve ser
promovido para `test/fixtures/`, que é versionado e roda no CI. O sandbox
não é executado por nenhum teste — nada aqui protege contra regressão.

## Como recriar

```bash
mkdir -p sandbox
npx degit eximiaco/csharp_jeito_certo/Masterclass/engenharia_projetos/sample05 sandbox/sample05
```
