---
change: 2026-07-fatia-4
status: active
---

# Fatia 4 — fazer o specd funcionar fora deste repositório

## Por quê

As três primeiras fatias foram validadas contra um único repositório: este. Ele
é TypeScript, é um repositório git próprio, e nunca esteve dentro de uma árvore
ignorada por outro. Rodar a ferramenta contra um ERP .NET real de 206 arquivos
expôs sete defeitos em uma sessão, e nenhum deles tinha teste que o pegasse.

O mais grave não reprovava nada — ficava verde. Em diretório ignorado pelo
repositório pai, `git ls-files` sai com sucesso e devolve zero arquivos. O passo
5 da escada de âncoras morria inteiro, `anchor suggest` emudecia, e o gate
aprovava sem dizer que a rede de segurança não existia.

Isso virou P8: **ausência de dado não é conformidade.** A terceira instância do
mesmo modo de falha em três fatias.

## Escopo

Na ordem em que o relatório os priorizou, e ela é causal:

1. **Raiz do projeto.** Duas definições concorrentes no mesmo comando. Tudo
   depende de resolver isto antes.
2. **Visibilidade de arquivos.** Git cego cai para caminhada do sistema de
   arquivos.
3. **Relatar capacidade degradada.** O verde deixa de significar duas coisas.
4. **Fronteira de palavra.** `TenantAccessor` para de casar
   `TenantAccessorRegisterMiddleware`.
5. **`detect-stack` para .NET e Makefile**, com mensagem que não mente.
6. **`init`** — diretório órfão, template desatualizado, camadas omitidas.
7. **`anchor suggest`** — teto de frequência por termo. Cauda opcional.

Ficam fora: treesitter, hooks e `sync` com board.

## Treesitter fica fora, e o argumento está registrado

Grep acertou dez de dez no passo 3 contra C# moderno — construtor primário,
`record` posicional, sobrecarga, namespace com escopo de arquivo. Os dois
defeitos reais da busca não são de linguagem: substring casando prefixo, e
menção confundida com declaração. O primeiro é uma linha de regex; o segundo já
é mitigado pela convenção de a âncora carregar `public class X` em vez de `X`.

Gramática WASM contrariaria REQ-CLI-006, que exige que nenhuma entre no bundle.

## Dívida conhecida, não gatilhável

**Conteúdo de template não tem contrato que o governe.** O `init` gerava um
comentário descrevendo a política de âncora do Modelo A — *"a warning while its
requirement is in the active change delta"* — que REQ-ANC-006 aposentou na Fatia
2. Todo projeto criado desde então aprendeu a regra errada.

O texto está corrigido nesta fatia. O que não está resolvido é a classe: um
template é prosa dentro de código, e nenhum requisito pode afirmar que ele
descreve o comportamento vigente sem um checador semântico, que P1 mantém fora
do caminho de decisão.

REQ-CFG-004 ganha o que **é** gatilhável — o template lista todas as camadas de
`LAYER_ORDER`, e um teste compara os dois. O resto do texto continua verificável
só por leitura humana, e este parágrafo existe para que a próxima pessoa saiba
que a lacuna é conhecida e não esquecida.

## Critério de sucesso

Rodar de novo contra o mesmo ERP, do zero: `init` propõe `dotnet test`, o config
oferece as seis camadas, `anchor suggest` produz candidatas únicas, a colisão de
prefixo morre, a ambiguidade verdadeira continua recusada, e nenhum comando fica
verde com a busca cega.
