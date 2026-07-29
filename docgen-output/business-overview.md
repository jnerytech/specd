# Visão Geral de Negócio — specd

## Resumo Executivo

`specd` é uma ferramenta de linha de comando criada para resolver um problema muito específico e cada vez mais comum: quando times passam a usar assistentes de inteligência artificial para escrever código a partir de documentos de especificação ("specs"), esses documentos costumam funcionar bem no primeiro dia e depois começam a mentir. O código muda, é refatorado, arquivos são renomeados ou removidos — e a spec continua descrevendo uma versão do sistema que já não existe mais. Ninguém percebe até o dia em que alguém confia num documento desatualizado para tomar uma decisão.

O `specd` ataca esse problema fazendo com que a própria especificação seja verificada automaticamente, a cada mudança de código, com um resultado binário e objetivo: passou ou não passou. Se a spec descreve algo que não está mais no código, a verificação falha e impede que o trabalho avance — da mesma forma que um teste automatizado quebrado impede um deploy.

O projeto é mantido por um único autor (usuário jnerytech no GitHub), é de código aberto sob licença MIT, e está publicado no registro de pacotes npm como `@jnerytech/specd`. Encontra-se em estágio inicial de desenvolvimento (versão `0.0.x`): o núcleo do produto — verificação de especificação (`verify`), exploração de contexto (`explore`), arquivamento de mudanças (`archive`) e sincronização com ferramentas de gestão de projeto (`sync`) — já está implementado e é usado para validar o próprio repositório do produto a cada alteração. Duas peças importantes do ciclo completo, batizadas de `propose` e `apply`, ainda não foram sequer especificadas.

## Contexto de Negócio e Propósito

A prática de "desenvolvimento orientado por especificação" (spec-driven development, ou SDD) ganhou força junto com a adoção de agentes de IA para programar. A ideia é escrever, antes do código, um documento que descreve com precisão o que o sistema deve fazer — e usar esse documento tanto para guiar o agente de IA quanto para julgar se o resultado está correto.

O problema que o mercado ainda não resolveu bem é o que acontece depois da primeira versão. Na grande maioria das ferramentas de SDD hoje disponíveis, a spec funciona como um "prompt": ela é lida uma vez, orienta a geração do código, e a partir daí os dois caminhos — spec e código — seguem vidas separadas. Não existe mecanismo que force a spec a continuar dizendo a verdade. Esse fenômeno tem nome na engenharia de software: "drift" (deriva) — o afastamento gradual e silencioso entre o que o documento diz e o que o sistema realmente faz.

Drift é caro porque é invisível até o momento errado: um novo integrante do time lê a spec e implementa em cima de uma premissa que não é mais verdadeira; um agente de IA recebe a spec desatualizada como contexto e produz código coerente com uma realidade que já não existe; um auditor de conformidade confia num documento que descreve um controle que foi removido há meses. Em todos os casos, o custo do erro só aparece muito depois de ele ter sido cometido.

O `specd` propõe resolver isso de um jeito conceitualmente simples: cada requisito da especificação declara explicitamente **onde**, no código, ele é implementado — um arquivo e um ponto exato dentro dele (uma função, uma classe, um símbolo). A esse vínculo o produto chama de **âncora**, numa analogia direta com uma âncora de navio: ela prende o requisito a um ponto fixo da realidade. Um comando de verificação (`specd verify`) percorre todas as âncoras da especificação e confere, mecanicamente, se cada uma delas ainda aponta para algo que existe no código. Se um arquivo foi movido, uma função foi renomeada ou deletada, a âncora "não resolve mais" — e a verificação falha imediatamente, apontando exatamente qual requisito ficou órfão e o que fazer a respeito.

Esse mecanismo transforma a especificação de um documento de leitura opcional (que qualquer time acaba abandonando sob pressão de prazo) em algo que o jargão técnico chama de "load-bearing": um artefato que sustenta peso real, porque quebra o processo de trabalho quando para de ser verdadeiro. É essa característica — e não a qualidade da prosa do documento — que faz uma especificação sobreviver ao longo do tempo dentro de uma equipe real.

## Principais Capacidades e Funcionalidades

O `specd` organiza o trabalho em um ciclo de vida com quatro fases conceituais — **explorar, propor, aplicar e arquivar** — das quais duas estão hoje implementadas de ponta a ponta e duas ainda não existem. Somam-se a esse ciclo dois recursos transversais: verificação contínua e sincronização com ferramentas de gestão.

- **Exploração de contexto (`explore`).** Reúne informações vindas de fontes configuradas — um quadro de gestão de projeto, documentos de decisão arquitetural, ou outras integrações — e grava um pacote auditável dessas informações antes de qualquer trabalho começar. Se uma fonte marcada como obrigatória falhar, a exploração é interrompida em vez de seguir com informação incompleta.

- **Verificação (`verify`) — o "portão de qualidade".** É o comando central do produto e o único que pode reprovar um trabalho por motivo de qualidade (essa exclusividade é uma decisão deliberada do produto, não um acidente). Ele roda em camadas, cada uma checando um aspecto diferente: se o contexto obrigatório foi de fato coletado; se os identificadores e a gramática dos requisitos estão corretos; se todo requisito tem uma tarefa de trabalho associada; se toda âncora ainda resolve no código; se toda tarefa marcada como concluída tem de fato um registro de código correspondente (um "commit"); e, por fim, se a própria suíte de validação do projeto (testes, formatação, compilação) passa. As cinco primeiras camadas rodam em milissegundos, sem depender de internet — o que significa que a verificação pode rodar em qualquer ambiente fechado, inclusive dentro de esteiras de integração contínua sem acesso à rede.

- **Arquivamento (`archive`).** Quando um pacote de mudanças (uma "change") é concluído, o `archive` incorpora as mudanças descritas nele à especificação oficial do sistema e aposenta os identificadores que deixaram de existir. É o momento em que "o que foi proposto" vira "o que é verdade hoje".

- **Sincronização com quadros de gestão (`sync`).** Muitos times gerenciam trabalho em ferramentas como Redmine ou Azure DevOps, com cartões, responsáveis e status de andamento. O `sync` reconcilia a especificação com esse quadro externo — mas, de forma proposital, é um comando manual, nunca automático: qualquer coisa que escreve em um sistema de terceiros carrega risco (fechar um cartão errado descarta comentários e horas apontadas que não voltam), então essa decisão nunca é tomada silenciosamente, precisa ser deliberadamente acionada por uma pessoa.

- **Formato de especificação em linguagem controlada (EARS).** Os requisitos não são escritos em prosa livre — seguem um pequeno conjunto de padrões de frase padronizados (por exemplo, "QUANDO X acontecer, o sistema DEVE fazer Y"), o que permite que uma ferramenta automatizada valide a estrutura do requisito sem precisar entender o significado dele. Isso é o que possibilita checar mecanicamente se a especificação está bem formada, sem depender de um leitor humano ou de inteligência artificial para julgar.

- **Integração com assistentes de IA (hooks para Claude Code).** O produto se conecta a pontos de extensão do Claude Code — a ferramenta de linha de comando de assistente de IA da Anthropic — para rodar a verificação automaticamente em momentos-chave da sessão de trabalho do agente, fechando o ciclo entre "o agente escreveu código" e "alguém conferiu que a spec ainda bate com a realidade" sem depender de disciplina manual.

- **Sugestão de âncora.** Quando um requisito ainda não tem âncora, ou quando uma âncora se perde, o `specd` oferece um comando que varre o repositório e sugere candidatos plausíveis de arquivo e símbolo — sempre como sugestão para revisão humana, nunca como decisão automática.

Vale registrar com honestidade o estágio atual: das quatro fases do ciclo completo, apenas "explorar" e "arquivar" (junto com a verificação e a sincronização, que são transversais) estão implementadas e em uso. As fases "propor" — que converteria um pacote de exploração em um documento formal de mudança com tarefas associadas — e "aplicar" — que executaria essas tarefas uma a uma, com a verificação fechando o ciclo a cada passo — ainda não foram especificadas, e portanto não existem em código. O produto hoje cobre o início e o fim do ciclo, não o meio.

## Stakeholders e Usuários

- **Desenvolvedores individuais e times de engenharia que usam agentes de IA no dia a dia.** São o público primário: pessoas que já viram um agente de IA produzir código plausível a partir de um contexto desatualizado, e que querem um mecanismo objetivo para impedir isso de acontecer de novo.

- **Times que precisam de rastreabilidade entre requisito e código** — por exemplo, para fins de auditoria, conformidade regulatória ou simplesmente disciplina de engenharia — encontram no `specd` uma forma de provar, de forma verificável e automática, que um requisito declarado corresponde a um trecho de código real e localizável, e não apenas a uma promessa em um documento.

- **Times que gerenciam trabalho em ferramentas externas de acompanhamento de projeto** (quadros do tipo Redmine, e potencialmente Azure DevOps) se beneficiam da sincronização entre a especificação técnica e o cartão de acompanhamento visível para gestores e clientes.

- **O próprio autor e mantenedor do projeto**, que usa o `specd` para validar o repositório do próprio `specd` a cada alteração — uma prática conhecida como "dogfooding" (a ferramenta consome o próprio produto). Isso serve simultaneamente como prova de conceito e como rede de segurança contra regressão.

- **Usuários avaliando adoção precoce de uma ferramenta nova.** Como o produto está em versão inicial e ainda não tem o ciclo completo implementado, o público realista hoje é o de early adopters dispostos a rodar a partir do código-fonte clonado, não o de compradores de uma solução pronta e amplamente testada em produção.

## Proposta de Valor

O valor central do `specd` pode ser resumido numa frase: ele torna a mentira na especificação **detectável e barata de corrigir**, em vez de silenciosa e cara de descobrir. Isso se sustenta em um conjunto de compromissos de design que o projeto trata como inegociáveis:

- **Resultado sempre previsível.** A decisão de aprovar ou reprovar nunca depende de um modelo de inteligência artificial interpretando algo — depende exclusivamente de regras determinísticas (a âncora resolve ou não resolve). Isso significa que rodar a verificação duas vezes no mesmo código sempre dá o mesmo resultado, uma propriedade essencial para qualquer coisa usada como portão de qualidade em um processo de entrega.

- **Funciona sem depender de rede.** A verificação central não faz nenhuma chamada de rede — nem para um provedor de IA, nem para o quadro de gestão externo. Isso permite usá-la em ambientes fechados de integração contínua, sem custo de chamadas externas e sem o risco de uma verificação de qualidade falhar por causa de uma instabilidade de rede alheia ao código.

- **Nunca resolve ambiguidade sozinho.** Sempre que a ferramenta encontra uma situação ambígua — uma âncora que poderia apontar para mais de um lugar, um conflito de sincronização, um estado inconsistente — ela para e devolve a decisão para uma pessoa, em vez de adivinhar. Isso evita o tipo de erro silencioso que só aparece muito depois.

- **Nunca confunde "não consegui verificar" com "está tudo certo".** Um diretório sem nenhuma especificação para checar, uma fonte de contexto que falhou ao ser lida, uma busca que não encontrou nenhum arquivo — nenhuma dessas situações é tratada como aprovação. O histórico do próprio projeto documenta casos reais em que essa distinção evitou aprovações falsas, incluindo um caso em que um sistema de terceiros (o quadro de gestão) respondeu com sucesso a uma escrita que, na prática, não tinha sido aplicada — o que levou o produto a sempre reler o estado externo depois de escrever nele, em vez de confiar na resposta de confirmação recebida.

- **Nenhuma operação com custo real acontece sem ser visível.** Ações que não podem ser desfeitas — como fechar um cartão em um quadro de terceiros, ou reescrever a especificação oficial — sempre passam por um momento de revisão explícita antes de virar histórico permanente. O produto nunca toma essas decisões por conveniência silenciosa.

Em conjunto, essas garantias fazem da especificação algo em que se pode confiar operacionalmente, não apenas algo bem escrito no dia em que foi redigido.

## Considerações Futuras

É importante que qualquer stakeholder avaliando o `specd` hoje entenda com clareza os limites atuais do produto, em vez de projetar sobre ele capacidades que ainda não existem:

- **O ciclo de trabalho está incompleto.** As fases `propose` (transformar uma exploração de contexto em um documento formal de mudança com tarefas) e `apply` (executar essas tarefas uma a uma, com a verificação confirmando cada passo) ainda não foram especificadas nem implementadas. Hoje, a criação de novas mudanças e a execução de tarefas dependem de processo manual apoiado por um assistente de IA, e não de um comando dedicado do `specd`.

- **A integração com sistemas de gestão externa foi testada de fato contra um único fornecedor** — Redmine. A interface do produto foi desenhada para suportar mais de um adaptador (Azure DevOps é mencionado como possibilidade), mas qualquer afirmação sobre esse segundo fornecedor funcionando hoje seria dedução, não fato observado em uso real.

- **O produto está em versão muito inicial (linha `0.0.x`).** Isso é esperado para um projeto de mantenedor único em fase de validação de conceito, mas significa que interfaces, comandos e formato de configuração ainda podem mudar sem o tipo de garantia de compatibilidade que se espera de uma ferramenta madura.

- **Existe risco de confusão de nome.** Há um projeto não relacionado, também chamado "SpecD", publicado sob o pacote `@specd/cli` por outros autores, sem qualquer afiliação com este produto. O único ponto prático de atrito é que, se as duas ferramentas forem instaladas globalmente no mesmo ambiente, o nome do executável (`specd`) pode colidir e uma sombrear a outra na linha de comando.

- **Caminho de evolução natural.** Do ponto de vista de negócio, os passos que mais aumentariam a utilidade prática do produto são, nesta ordem de dependência: (1) fechar o ciclo completo com `propose` e `apply`, o que tornaria o `specd` capaz de conduzir uma mudança do início ao fim sem depender de trabalho manual intermediário; (2) validar a integração com um segundo fornecedor de quadro de gestão, o que provaria (ou refutaria) que a interface de adaptador realmente generaliza; e (3) automatizar a chamada de `sync` a partir do `archive`, hoje ainda uma decisão manual — o próprio time do produto já identificou essa lacuna, mas trata a automação com cautela deliberada, justamente porque fechar um cartão em um sistema de terceiro é uma ação que não se desfaz.

Em resumo: o `specd` já entrega, de forma testada e usada no próprio desenvolvimento do produto, o núcleo da sua proposta — detecção automática e determinística de divergência entre especificação e código. O que falta é o restante do fluxo de trabalho ao redor desse núcleo, e isso é uma lacuna conhecida e declarada pelo próprio projeto, não uma limitação escondida.
