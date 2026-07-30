---
change: 2026-07-30-statement-review
status: active
---

# statement-review — o enunciado passa a ter quem o leia

## Por quê

Âncora se verifica por resolução, e o gate faz isso. Enunciado se verifica por
julgamento, e ninguém faz. A prova está no repositório: requisitos entraram em
`origin: specs` com quantificação que a âncora não cobre, com âncora que resolve
sem realizar o comportamento, e com critério de aceite que nenhum teste toca.
Passaram por leitura, apply, gate verde e archive sem ninguém parar neles.

Julgamento não pode entrar no CLI — seria decisão de LLM no caminho, contra
`no-llm-in-decision-path`, e é assim que `single-gate` se dissolve. Sobra a
camada de skill, que é onde o julgamento já mora e onde a pergunta ao autor já é
a saída prevista.

## Duas posições, pesos diferentes

`specd-propose` revê todo statement que escreve. Corrigir ali é gratuito: o
requisito ainda é `origin: delta`, nenhuma task o cita, nenhuma âncora tem
histórico.

`specd-archive-change` revê só o que mudou desde o propose. Escopo estreito é
deliberado: é o pior momento para descobrir enunciado ruim, e revisão cara nessa
posição vira revisão burlada.

## A razão da divisão, para não ser redecidida

No propose o requisito é `origin: delta` e o símbolo da âncora pode não existir
ainda — "a âncora realiza o que o statement afirma?" não tem resposta ali, e
exigir a pergunta produziria respostas inventadas.

No archive ela tem: o apply escreveu o código, e a âncora que estava pendurada
agora resolve. Foi exatamente aí que a âncora errada de REQ-SKL-003 se tornou
observável — ela nunca mudou de texto, mudou de estado, e passou a apontar para
um símbolo que existe e não realiza nada do que o statement descreve.

Uma janela só não pega as duas causas: a primeira erra ao escrever, a segunda
erra ao implementar.

## O que esta change não faz

Não conserta os quatro enunciados fracos. Três deles moram na capability que esta
change edita, e a tentação aparece com o arquivo aberto — mas eles estão em
`origin: specs` e exigem delta MODIFIED próprio. Eles servem aqui como conjunto
de avaliação, e consertá-los antes destruiria o material.

Nada de verificação de enunciado entra no CLI.
