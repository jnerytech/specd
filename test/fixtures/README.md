# test/fixtures — repositórios sintéticos, versionados de propósito

**Esta pasta é versionada.** Ao contrário de `.reference/` e `sandbox/`, ela
**não** entra no `.gitignore` — e isso é deliberado.

Os fixtures são o dado de entrada dos testes da escada de âncoras
(REQ-ANC-002 em `.specd/specs/anchors.md`). São repositórios em miniatura
com drift conhecido: cada um foi construído para forçar exatamente um passo
da escada e produzir exatamente um resultado.

Ignorá-los deixaria o CI sem o que verificar. O teste continuaria existindo,
mas rodaria contra um diretório vazio e passaria por vacuidade — o pior tipo
de teste verde.

## Fixtures

| Fixture                 | Estado                            | Passo | Resultado esperado         |
| ----------------------- | --------------------------------- | ----- | -------------------------- |
| `resolved-with-symbol/` | Arquivo e símbolo presentes       | 3     | `resolved`                 |
| `resolved-file-only/`   | Âncora sem `symbol`               | 2     | `resolved`                 |
| `missing-file/`         | Arquivo removido                  | 1     | `dangling`                 |
| `renamed-symbol/`       | Arquivo existe, símbolo renomeado | 5     | `dangling`                 |
| `moved-symbol/`         | Símbolo migrou, único match       | 5     | `dangling-with-suggestion` |
| `ambiguous-symbol/`     | Símbolo em vários arquivos        | 5     | `dangling` sem sugestão    |

A coluna "Passo" é o degrau da escada onde a resolução para. É ela que dá
sentido ao conjunto: cada degrau tem pelo menos um fixture que o exercita, e
os dois últimos casos separam o desfecho com sugestão do desfecho sem.

## Como escrever um fixture

Pequeno e legível: de dois a três arquivos cada. O que importa é o **estado**,
não o realismo. Um fixture não precisa parecer um projeto de verdade — precisa
colocar o resolver na situação exata que o teste quer observar.

Código plausível o bastante para ser lido, curto o bastante para ser óbvio na
revisão do diff.

## Ainda não existem

Os diretórios acima são trabalho da tarefa 005. Este README documenta o
contrato antes da implementação.
