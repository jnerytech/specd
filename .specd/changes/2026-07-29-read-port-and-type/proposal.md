---
change: 2026-07-29-read-port-and-type
status: active
---

# ephemeral-port — o segundo `specd read` não pode falhar

## Por quê

`DEFAULT_PORT = 4173` fixo funciona para uma instância e só. Ler duas coisas ao
mesmo tempo — a spec num terminal e uma pasta de notas no outro — é o uso
normal da ferramenta, e o segundo comando morre com `EADDRINUSE` mandando
escolher outra porta à mão.

O erro está correto e é inútil: ele nomeia um problema que a máquina resolve
sozinha. O sistema operacional já sabe qual porta está livre, e pedir isso a
ele custa uma linha.

## A decisão, e o que ela troca

`listen(0)` — o SO atribui uma porta comprovadamente livre. Sem sorteio, sem
intervalo, sem retry.

Alternativa considerada e recusada: **sortear num intervalo fixo e tentar de
novo em colisão.** Ela não tem vantagem sobre a efêmera — mesma URL
imprevisível, mais código, e ainda pode falhar por azar. Sorteio onde existe
resposta determinística é adivinhação com passos extras.

Alternativa considerada e recusada: **4173 primeiro, efêmera se ocupada.**
Preservaria a URL estável no caso de uma instância só, que é real. Foi recusada
porque o fallback é silencioso por natureza — a mesma execução às vezes dá
`4173` e às vezes dá `57904`, e explicar isso na saída custa uma linha de
relatório a cada leitura para pagar por um bookmark. Uma regra é melhor que uma
regra com exceção.

**O que se perde está declarado:** a URL muda a cada execução, então bookmark
não sobrevive a reiniciar o servidor. É preço aceito, não descuido — o comando
imprime a URL toda vez, e o gesto é clicar no terminal, não guardar o endereço.

`--port` continua pinando, e continua saindo 2 quando a porta pedida está
ocupada. Pedir uma porta específica e não conseguir é falha; não pedir nenhuma
e o SO escolher não é.

## Escopo

Um requisito novo para a escolha da porta, e uma modificação em REQ-READ-005
para que o critério de porta ocupada passe a valer só quando a porta foi
pedida. Os outros quatro critérios de REQ-READ-005 não mudam.

## Fora de escopo

Descobrir instâncias já rodando, listar as portas em uso, ou reaproveitar um
servidor vivo. São a próxima pergunta e não esta; hoje cada `specd read` é um
processo independente e é isso que a change preserva.
