---
change: 2026-07-28-hooks-enforce-the-gate
status: active
---

# hooks-enforce-the-gate — hooks: o que torna o gate obrigatório

## Por quê

Quatro changes produziram um gate que funciona e que ninguém é obrigado a rodar.
`specd verify` só reprova quem o chama. Enquanto chamá-lo for opcional, a
detecção de drift é uma sugestão, e a change anterior mostrou o que acontece com
sinais que ninguém é obrigado a olhar.

O hook fecha isso: o agente não encerra sem passar pelo gate.

## A decisão de projeto, e o que ela custou ao desenho original

`PostToolUse` e `Stop` rodam **`--fast` nos dois**. O verify completo fica no CI.

`--fast` pula exatamente uma camada — `project` —, e `project` não roda
verificação do specd: delega para `verify.validation_command`, que num repositório
.NET é `dotnet test`, quatro minutos, e que o CI já roda. As cinco camadas que
sobram são leitura de arquivo, e é nelas que mora a detecção de drift inteira.

O argumento que decide não é o custo em si, é a assimetria: quem desliga o hook
porque `dotnet test` leva quatro minutos perde junto a checagem de âncora que
custava 40ms. **A parte barata paga o preço da cara, e a parte barata é o
diferencial inteiro.**

O meio-termo — completo só quando o diff tocou código — foi rejeitado. Classificar
"isto é código" é lista de extensões, e erra no caso que importa (`.csproj`
alterado muda o build). Pior: o valor de rodar a suíte é maior justamente quando
ninguém tem certeza de que o diff era seguro, então decidir pelo conteúdo do diff
é o gate concordando com a premissa que deveria testar. E torna o veredito
irreprodutível a partir do estado do repositório.

`--full-on-stop` existe, e é escrito no `settings.json` em vez de virar knob no
`config.toml`. Dois clientes reais divergem por **custo** — `npm test` de três
segundos contra suíte .NET de minutos —, e custo é propriedade do cliente, não
preferência, então config-only-on-divergence passa. Mas a escolha fica legível no arquivo que o host lê,
não escondida em configuração que ninguém abre.

## O adaptador, e por que ele existe como comando separado

Os exit codes do specd e os do Claude Code colidem invertidos:

| | specd | hook do host |
| --- | --- | --- |
| 0 | sucesso | sucesso |
| 1 | **gate reprovou** | erro não-bloqueante, só mostrado ao usuário |
| 2 | ferramenta quebrou | **bloqueia, stderr volta ao agente** |

`specd verify` cru como comando de hook produz o pior par possível: âncora
quebrada não impede o agente de encerrar, e specd quebrado impede.

Daí `specd hooks run`. Ele fala **o protocolo do host, não o do specd**: o 2 dele
é a convenção de bloqueio do Claude Code, não o "recusa de agir" do REQ-CLI-001.
A fronteira entre os dois contratos de exit code mora nesse comando, e é por isso
que ele existe em vez de o `settings.json` chamar `verify` direto. single-gate fica
intacta — o adaptador nunca reivindica exit 1, e um teste de arquitetura impede
que qualquer módulo alcançável a partir dele importe o `EXIT` do specd.

**Falha fechada.** O bloqueio é o exit code; o JSON no stdout enriquece a
mensagem. Se o host ignorar o payload, o exit code ainda bloqueia. A alternativa
— sair 0 sempre e confiar o veredito ao payload — falha abrindo em silêncio, que
é absence-is-not-compliance na forma mais pura.

E absence-is-not-compliance de novo no outro sentido: não conseguir rodar o gate (não é projeto specd,
config inválida, exceção inesperada) bloqueia com a razão nomeada. "Não verifiquei"
nunca é verde.

## A spec-sombra vira precedente

O documento de proposta original do produto previa:

> REQ-HOOK-001 — PostToolUse → verify rápido; Stop → verify completo

e `.reference/README.md:59` registra o desenho complementar, *"gate por exit code
no hook `Stop`"*.

**Os dois estão superados, por dois achados independentes desta change.** O `Stop`
completo caiu pelo argumento de custo assimétrico; o exit code direto caiu pela
colisão de contratos. Nenhum dos dois foi derrubado por preferência — os dois
foram derrubados por evidência que só apareceu ao escrever o comando.

Isso muda o estatuto da spec-sombra. Ela era dívida — requisitos citados que
`.specd/specs/` não continha. Passa a ser **precedente útil**: um registro do que
o desenho previa antes do contato com o campo, e a change `hooks-enforce-the-gate` é a primeira change que
o contradiz por medição em vez de por revisão. A capability `hooks` é escrita do
zero, sem olhar para aqueles IDs; a coincidência de numeração é acidente.

## Escopo

1. **Capability `hooks`**, nova, sete requisitos.
2. **`specd hooks install`** — merge preservando terceiros, `--full-on-stop`,
   `--force`, não staged.
3. **`specd hooks uninstall`** — remove só o que reconhece como seu.
4. **`specd hooks run stop` e `post-tool-use`** — o adaptador.
5. **`anchor suggest --file <caminho>`** — lista as declarações do arquivo.
   Determinístico, sem heurística, sem junção em PascalCase. O modo sem `--file`
   fica como está.

Ficam fora: `sync` com board, `propose`, memória.

## `--file` inverte a ferramenta, e é por isso que entra aqui

O run 002 mediu por que o extrator de termos não produz candidata única: os termos
que ele levanta da prosa (`Suspended`, `Tenant`) não são nomes de tipo
(`SuspendedState`, `TenantAccessor`). Um requisito que nomeia o símbolo quase não
precisa de sugestão; o que não nomeia é o caso a servir, e é onde não há o que
buscar.

`--file` desiste de adivinhar o símbolo a partir do requisito e passa a listar o
que o arquivo declara — que é o fluxo real, porque quem escreve requisito sobre
código existente já leu o arquivo. Juntar palavras em PascalCase para inventar
nome de símbolo continua proibido por no-guessing-on-conflict.

E absence-is-not-compliance vale aqui também: extensão sem padrão de declaração conhecido reporta isso.
Lista vazia por não saber ler o arquivo seria indistinguível de arquivo sem
declaração.

## O primeiro requisito cuja verificação sai do processo

O critério que importa — hook instalado, âncora quebrada, agente impedido de
encerrar — não se prova com teste unitário. Exige o Claude Code rodando de verdade
contra uma versão específica do host, e o formato do payload é contrato de terceiro
que pode mudar sem aviso.

Fica registrado como run de sandbox: `sandbox/runs/003-hooks-enforce-the-gate.md`, com a versão do
host, o payload enviado e o comportamento observado. Se o formato mudar numa versão
futura, é esse arquivo que diz contra o que funcionou.

Isto é dívida conhecida, da mesma família do conteúdo de template: o requisito é
real, a verificação é humana, e o registro existe para que a próxima pessoa saiba
que a lacuna é conhecida e não esquecida.

## Critério de sucesso

`hooks install` duas vezes não duplica; hook de terceiro sobrevive; settings
malformado sai 2 sem escrever; `uninstall` remove só o que reconhece;
`anchor suggest --file` lista as declarações de um arquivo `.cs` do sample05; e o
hook instalado neste repositório impede o agente de encerrar com âncora quebrada.
