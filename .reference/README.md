# .reference — código de terceiros, apenas leitura

**Esta pasta é ignorada pelo git.** Só este README é versionado. O conteúdo
dos repositórios clonados aqui nunca entra em commit — o que se versiona são
as regras de uso, não o código de outra pessoa.

Nada aqui é dependência do specd. Nada aqui é importado, compilado ou
testado. São repositórios de leitura, disponíveis para consulta pontual
quando uma tarefa precisa ver como outro projeto resolveu um problema
parecido.

## Repositórios clonados

| Pasta       | Origem                         | Licença | Copyright                  |
| ----------- | ------------------------------ | ------- | -------------------------- |
| `openspec/` | github.com/Fission-AI/openspec | MIT     | 2024 OpenSpec Contributors |
| `compozy/`  | github.com/compozy/compozy     | MIT     | 2026 NauckGroup LTDA       |

Ambos foram clonados com `--depth 1` e tiveram o `.git` removido, para
evitar submódulo acidental e economizar espaço.

## O que a licença MIT exige

Copiar **trecho literal** de código — uma função, um bloco, um arquivo —
obriga a preservar o aviso de copyright e o texto da licença de origem
junto do trecho copiado. Isso vale mesmo para pedaços pequenos.

Absorver **ideia ou padrão arquitetural** não exige nada. Entender como o
openspec organiza a máquina de estados de um delta e resolver o mesmo
problema com código próprio não gera obrigação de atribuição. Aprender é
livre; copiar é que tem condição.

Na dúvida: se o resultado tem a mesma forma sintática do original, é cópia.
Se tem a mesma ideia mas foi escrito do zero, não é.

## Regra de leitura

**Leitura pontual, nunca varredura.** Abrir o arquivo específico que
responde a uma pergunta específica. Nunca percorrer o repositório inteiro
para "entender como funciona".

O motivo é orçamento de contexto. Cada arquivo lido daqui ocupa espaço que
deveria estar com `.specd/` — as specs e as tarefas, que são o contrato do
que estamos construindo. Contexto gasto com código de terceiros é contexto
que falta para o contrato.

O fluxo correto é: ter uma pergunta concreta → localizar o arquivo que a
responde → ler só ele → voltar para a spec.

## Cuidado com contaminação arquitetural

O Compozy resolve problemas adjacentes com decisões opostas às nossas:

| specd                               | Compozy                                   |
| ----------------------------------- | ----------------------------------------- |
| Sem daemon; processo efêmero        | Daemon home-scoped                        |
| Sem worktrees; execução sequencial  | Worktrees paralelos                       |
| CLI nunca chama LLM na decisão      | Agente de recovery dentro da CLI          |
| Gate por exit code no hook `Stop`   | `cy-final-verify` por atestação do agente |
| Estado no repositório               | Estado em `~/.compozy/`                   |
| Memória efêmera, vai para o archive | Memória persistente                       |

Encontrar essas soluções no código-fonte não é permissão para adotá-las.
Elas foram rejeitadas com motivo, registrado nos princípios do
AGENTS.md.

## Quando consultar

| Pergunta                                   | Onde        | Quando                                     |
| ------------------------------------------ | ----------- | ------------------------------------------ |
| Máquina de estados delta → specs → archive | `openspec/` | change `archive-cycle-and-effective-specs` |
| Geração de config para múltiplos agentes   | `openspec/` | hooks install                              |
| Precedência de TOML                        | `compozy/`  | design apenas — é Go                       |
| Compactação de memória por limite numérico | `compozy/`  | change `provenance-and-mcp-transport`      |

A linha do TOML merece ênfase: o Compozy é escrito em Go. O que se aproveita
dali é o desenho da precedência entre camadas de configuração, não código.

## Como recriar

```bash
mkdir -p .reference
git clone --depth 1 https://github.com/Fission-AI/openspec .reference/openspec
git clone --depth 1 https://github.com/compozy/compozy   .reference/compozy
rm -rf .reference/*/.git
```
