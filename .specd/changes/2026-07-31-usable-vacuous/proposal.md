---
change: 2026-07-31-usable-vacuous
status: active
---

# usable-vacuous — o bundle que se declara usável sem ter coletado nada

## Por quê

`specd explore` contra um board fora do ar sai 0 e escreve `bundle: usable`,
quando o repositório declara board e não declara nenhuma fonte obrigatória.
Duas configurações que se leem como "tenho board" têm desfechos opostos diante
da mesma queda de rede.

É coerente com o requisito e ruim para quem lê: nenhuma fonte obrigatória
significa que nada falhou, e nada falhando sai verde. Verdade vacuamente
verdadeira apresentada como verificação — a forma que `absence-is-not-compliance`
recusa, e a mais perigosa que este projeto persegue, porque produz resposta
errada com aparência de certa em vez de falhar para o lado seguro.

A skill `specd-explore` manda parar quando o board está inalcançável. Ela só não
tem como saber que está, se o comando não disser.
