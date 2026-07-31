# sandbox — experimentação manual

**Três coisas moram aqui, e só duas são versionadas.**

- `runs/*.md` e `RELATORIO.md` **entram no git**. São a evidência de que um
  comportamento mudou e a fila que orienta o próximo trabalho; fora do
  repositório não sobrevivem a um clone, e o link de uma pendência para a run
  que a mediu vira referência morta.
- `runs/<n>/` e o resto — alvos de rodada, clones, container — **ficam fora**.
  São projetos completos, alguns com `.git` próprio, grandes e regeneráveis a
  partir da receita que cada registro carrega.

Todo registro de run diz como o alvo dele foi montado. Isso é condição para o
alvo poder ficar de fora: registro que só faz sentido com o diretório ao lado
não se sustenta depois do clone.

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

## Como recriar o alvo .NET

```bash
mkdir -p sandbox
npx degit eximiaco/csharp_jeito_certo/Masterclass/engenharia_projetos/sample05 sandbox/sample05
```
