# painel-web.md

# Plano de criação do sistema web da Gincana Linguística — MVP

## 1. Visão geral

Este documento descreve a criação de um sistema web para executar a **Gincana Linguística do IFTO** em formato de MVP, isto é, uma primeira versão funcional, simples e testável.

A proposta geral é transformar a gincana em uma aplicação web acessada pelo navegador, deixando o WhatsApp fora do fluxo principal da atividade. O sistema terá login para o organizador e para os dois grupos participantes:

```txt
organizador
Agrogramáticos
Morfosintáxicos
```

Nesta primeira versão, o foco não será criar uma plataforma completa com colaboração em tempo real, chat interno, IA avaliadora obrigatória ou controle sofisticado de duelistas. O objetivo do MVP é garantir o fluxo essencial:

```txt
organizador inicia a rodada
grupo visualiza a tarefa
grupo envia resposta
organizador visualiza as respostas
organizador atribui nota/ponto
placar é atualizado
```

Depois que esse fluxo estiver funcionando, o sistema poderá receber melhorias como avaliação automática com IA, chat interno, timer, passa/repassa, múltiplos usuários por grupo, modo apresentação e atualização em tempo real.

---

## 2. Objetivo do MVP

O objetivo do MVP é construir uma versão mínima do sistema que permita realizar a gincana de maneira organizada, mesmo que algumas partes ainda sejam manuais.

O sistema deve permitir:

```txt
login do organizador;
login dos dois grupos;
visualização da dinâmica atual;
criação ou seleção de rodada;
envio de respostas pelos grupos;
visualização das respostas pelo organizador;
atribuição manual de notas;
adição manual de pontos;
exibição do placar;
registro simples de eventos.
```

A prioridade desta versão é a estabilidade. O sistema deve funcionar mesmo sem IA, sem chat interno e sem automações avançadas.

---

## 3. Escopo reduzido do MVP

Para evitar que o projeto fique grande demais logo no início, algumas funcionalidades devem ser deixadas para versões futuras.

## 3.1 O que entra no MVP

Entram no MVP:

```txt
tela de login;
tela do organizador;
tela dos grupos;
placar dos dois times;
controle simples de dinâmica;
controle simples de rodada;
campo de resposta para cada grupo;
envio de resposta final;
visualização das respostas no painel do organizador;
campo para nota manual;
botão para adicionar pontos;
histórico simples de eventos.
```

## 3.2 O que fica para depois

Ficam para versões futuras:

```txt
chat interno por grupo;
múltiplos usuários individuais por equipe;
mural de ideias;
capitão ou líder de grupo;
timer avançado;
Supabase Realtime obrigatório;
avaliação automática com IA;
modo silencioso de preparação;
controle completo de duelistas;
passa e repassa;
pontuação dobrada automática;
rota separada de projetor;
modo apresentação;
animações e efeitos sonoros.
```

Esses recursos são interessantes, mas não são necessários para validar o funcionamento principal da gincana.

---

## 4. Justificativa da versão enxuta

Como a atividade será coletiva e pode envolver limitações de espaço, internet, computadores e organização em sala, o MVP deve evitar complexidade excessiva.

A ideia inicial de ter um computador por equipe pode funcionar, mas nem sempre a realidade da sala segue o planejamento. Uma alternativa logística possível é usar laboratórios separados: um grupo em um laboratório e outro grupo em outro. Isso reduziria o risco de um time ouvir a argumentação do outro, especialmente durante o Júri Popular.

Por esse motivo, o sistema não precisa resolver imediatamente todos os problemas de colaboração. Em vez disso, o MVP deve oferecer o básico para que a atividade aconteça:

```txt
cada grupo acessa sua tela;
cada grupo envia sua resposta;
o organizador controla a pontuação;
o placar aparece no painel.
```

A solução pedagógica e logística pode ser ajustada na execução da atividade. O sistema deve ser simples o suficiente para ser usado mesmo em condições imperfeitas.

---

## 5. Tecnologias recomendadas

## 5.1 Frontend

Recomendação principal:

```txt
React + Vite
```

O React com Vite é adequado porque permite criar rapidamente uma interface web leve, modular e organizada.

Componentes iniciais recomendados:

```txt
Login
PainelOrganizador
TelaGrupo
Placar
CardResposta
ControleRodada
HistoricoEventos
```

## 5.2 Banco de dados

Recomendação principal:

```txt
Supabase
```

O Supabase pode ser usado para armazenar:

```txt
partidas;
times;
rodadas;
respostas;
pontuação;
eventos.
```

No MVP, o sistema pode funcionar com consultas simples. A atualização em tempo real via Supabase Realtime pode ser deixada para depois. Caso necessário, pode-se usar atualização manual ou polling simples.

## 5.3 IA

A avaliação automática com IA não deve ser obrigatória no MVP.

Nesta primeira versão, o organizador poderá atribuir notas manualmente. A IA pode ser adicionada depois para sugerir notas, feedbacks e vencedores de rodada.

Regra recomendada para versões futuras:

```txt
IA sugere.
Organizador confirma.
Sistema pontua.
```

---

## 6. Tipos de usuário

## 6.1 Organizador

O organizador é o usuário que controla a gincana.

Permissões do organizador no MVP:

```txt
entrar no painel administrativo;
ver placar;
selecionar a dinâmica atual;
criar ou iniciar rodada;
ver respostas enviadas;
atribuir nota manual;
adicionar pontos;
registrar resultado da rodada;
avançar para próxima rodada;
finalizar a gincana.
```

A tela do organizador poderá ser projetada, mas no MVP ela não precisa ter uma rota separada para o projetor.

## 6.2 Grupos

Os grupos entram no sistema com login coletivo.

Grupos previstos:

```txt
Agrogramáticos
Morfosintáxicos
```

Permissões dos grupos no MVP:

```txt
entrar na tela do grupo;
ver a dinâmica atual;
ver a tarefa ou pergunta da rodada;
escrever uma resposta;
enviar a resposta final;
ver status de envio.
```

No MVP, não haverá login individual para cada aluno. Cada equipe usará um único acesso coletivo.

---

## 7. Estrutura de telas

## 7.1 Tela de login

A tela de login deve permitir acesso para:

```txt
organizador;
Agrogramáticos;
Morfosintáxicos.
```

Campos iniciais:

```txt
login;
senha.
```

Após o login:

```txt
organizador -> Painel do Organizador
grupo -> Tela do Grupo
```

---

## 7.2 Tela do organizador

A tela do organizador deve concentrar o controle da gincana.

Estrutura sugerida:

```txt
--------------------------------------------------
GINCANA LINGUÍSTICA DO IFTO
--------------------------------------------------

Placar:
Agrogramáticos: X pontos
Morfosintáxicos: Y pontos

Dinâmica atual:
Júri Popular / Clash

Round atual:
N

--------------------------------------------------
Controle da rodada
--------------------------------------------------

[Selecionar dinâmica]
[Iniciar nova rodada]
[Finalizar rodada]

--------------------------------------------------
Respostas enviadas
--------------------------------------------------

Agrogramáticos:
[resposta enviada]
Nota:
[campo de nota]
[Adicionar ponto]

Morfosintáxicos:
[resposta enviada]
Nota:
[campo de nota]
[Adicionar ponto]

--------------------------------------------------
Eventos
--------------------------------------------------

Últimos acontecimentos da gincana
```

Essa tela deve ser clara o suficiente para ser projetada, mas não precisa esconder informações no MVP. Se depois houver preocupação com exposição de respostas antes da hora, pode-se criar um modo de apresentação ou estados de visualização.

---

## 7.3 Tela dos grupos

A tela dos grupos deve ser simples e objetiva.

Estrutura sugerida:

```txt
--------------------------------------------------
Gincana Linguística do IFTO
--------------------------------------------------

Seu grupo:
Agrogramáticos / Morfosintáxicos

Dinâmica atual:
Júri Popular / Clash

Round atual:
N

Tarefa ou pergunta:
[texto da tarefa]

Resposta do grupo:
[campo de texto]

[Enviar resposta final]
```

Após o envio, a tela pode mostrar:

```txt
Resposta enviada.
Aguardando avaliação do organizador.
```

No MVP, não é necessário permitir edição após o envio. Caso seja necessário, o organizador pode reiniciar a rodada ou liberar uma nova resposta em versão futura.

---

## 8. Banco de dados do MVP

A modelagem inicial deve ser simples. O objetivo é registrar a partida, os times, as rodadas, as respostas e os eventos.

---

## 8.1 Tabela `gincana_partidas`

Guarda a gincana em andamento.

```sql
create table gincana_partidas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  status text not null default 'aguardando',
  dinamica_atual text,
  round_atual integer default 0,
  criado_em timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now()
);
```

Possíveis valores para `status`:

```txt
aguardando
em_andamento
finalizada
```

Possíveis valores para `dinamica_atual`:

```txt
juri_popular
clash
```

---

## 8.2 Tabela `gincana_times`

Guarda os times participantes.

```sql
create table gincana_times (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid references gincana_partidas(id),
  nome text not null,
  slug text not null,
  pontos integer default 0,
  criado_em timestamp with time zone default now()
);
```

Times previstos:

```txt
Agrogramáticos
Morfosintáxicos
```

---

## 8.3 Tabela `gincana_usuarios`

Guarda os usuários de acesso ao sistema.

```sql
create table gincana_usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  login text unique not null,
  senha_hash text not null,
  papel text not null,
  time_id uuid references gincana_times(id),
  criado_em timestamp with time zone default now()
);
```

Papéis possíveis:

```txt
organizador
grupo
```

No MVP, também é aceitável começar com autenticação simplificada, desde que o sistema seja usado em ambiente controlado. Porém, para evitar acessos indevidos, recomenda-se ao menos usar senhas diferentes para cada perfil.

---

## 8.4 Tabela `gincana_rounds`

Registra as rodadas.

```sql
create table gincana_rounds (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid references gincana_partidas(id),
  dinamica text not null,
  numero integer not null,
  status text default 'aguardando',
  tarefa text,
  vencedor_time_id uuid references gincana_times(id),
  criado_em timestamp with time zone default now(),
  finalizado_em timestamp with time zone
);
```

Possíveis valores para `status`:

```txt
aguardando
em_andamento
finalizado
anulado
```

O campo `tarefa` pode guardar o tema, pergunta ou comando da rodada.

---

## 8.5 Tabela `gincana_respostas`

Guarda as respostas enviadas pelos grupos.

```sql
create table gincana_respostas (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid references gincana_partidas(id),
  round_id uuid references gincana_rounds(id),
  time_id uuid references gincana_times(id),
  texto_resposta text not null,
  nota_final numeric,
  feedback_final text,
  status text default 'enviada',
  criado_em timestamp with time zone default now()
);
```

Possíveis valores para `status`:

```txt
enviada
avaliada
confirmada
anulada
```

No MVP, os campos `nota_final` e `feedback_final` podem ser preenchidos manualmente pelo organizador.

---

## 8.6 Tabela `gincana_eventos`

Guarda o histórico da gincana.

```sql
create table gincana_eventos (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid references gincana_partidas(id),
  tipo text not null,
  descricao text not null,
  time_id uuid references gincana_times(id),
  pontos integer default 0,
  criado_em timestamp with time zone default now()
);
```

Tipos de evento possíveis:

```txt
gincana_iniciada
dinamica_alterada
round_iniciado
resposta_enviada
nota_atribuida
pontos_adicionados
round_finalizado
gincana_finalizada
```

---

## 9. Fluxo do Júri Popular no MVP

## 9.1 Ideia da dinâmica

O Júri Popular é uma dinâmica de argumentação sobre preconceito linguístico. Os grupos assumem papéis opostos:

```txt
Acusação
Defesa
```

A acusação deve argumentar contra o preconceito linguístico. A defesa deve argumentar, dentro da proposta da dinâmica, que o preconceito linguístico seria necessário para preservar uma determinada ordem gramatical.

No MVP, a avaliação será feita manualmente pelo organizador.

---

## 9.2 Fluxo simplificado

```txt
1. Organizador seleciona "Júri Popular".
2. Organizador cria uma nova rodada.
3. Organizador define a tarefa/tema da rodada.
4. Cada grupo visualiza a tarefa.
5. Cada grupo envia sua resposta.
6. Organizador lê as respostas.
7. Organizador atribui nota manual.
8. Organizador escolhe o vencedor da rodada.
9. Sistema adiciona os pontos.
10. Organizador avança para a próxima rodada.
```

Pontuação inicial sugerida:

```txt
vencedor do round: +1 ponto
veredito final após 3 rounds: +5 pontos
```

No MVP, o veredito final pode ser aplicado manualmente pelo organizador.

---

## 10. Fluxo do Clash no MVP

## 10.1 Ideia da dinâmica

O Clash é uma dinâmica de perguntas abertas. No formato completo, ele envolve duelistas, eliminação, passa/repassa e pontuação dobrada.

No MVP, recomenda-se implementar apenas uma versão simplificada.

---

## 10.2 Fluxo simplificado

```txt
1. Organizador seleciona "Clash".
2. Organizador cria uma nova rodada.
3. Organizador digita ou escolhe uma pergunta.
4. Os grupos visualizam a pergunta.
5. Os grupos enviam suas respostas.
6. Organizador lê as respostas.
7. Organizador atribui nota ou decide quem respondeu melhor.
8. Organizador adiciona pontos manualmente.
9. Organizador inicia a próxima pergunta.
```

Nesta versão, não entram ainda:

```txt
controle de duelistas;
eliminação automática;
passa e repassa;
timer;
pontuação dobrada.
```

Esses elementos devem ser implementados apenas depois que o fluxo básico estiver estável.

---

## 11. Relação com o PascalBOT

Com o MVP web, o PascalBOT não será a interface principal. Ele poderá ser reaproveitado futuramente como serviço de avaliação e geração de perguntas.

No primeiro momento, o sistema deve funcionar sem depender da IA.

Depois, podem ser adicionados:

```txt
botão "Avaliar com PascalBOT";
nota sugerida pela IA;
feedback sugerido pela IA;
comparação entre respostas;
sugestão de vencedor;
geração automática de perguntas para o Clash.
```

A integração futura deve seguir a regra:

```txt
PascalBOT avalia.
Organizador revisa.
Sistema pontua.
```

---

## 12. Estrutura sugerida do projeto

Estrutura usando React + Vite:

```txt
painel-gincana/
  public/
  src/
    components/
      LoginForm.jsx
      Placar.jsx
      PainelOrganizador.jsx
      TelaGrupo.jsx
      CardResposta.jsx
      ControleRodada.jsx
      HistoricoEventos.jsx

    pages/
      Login.jsx
      Organizador.jsx
      Grupo.jsx

    services/
      supabaseClient.js
      authService.js
      gincanaService.js

    hooks/
      usePartidaAtual.js
      useGrupoAtual.js

    styles/
      global.css

    App.jsx
    main.jsx
```

A separação em componentes facilita a evolução posterior do sistema.

---

## 13. Ordem de desenvolvimento recomendada

A ordem de desenvolvimento do MVP deve ser:

```txt
1. Criar o projeto React + Vite.
2. Configurar o Supabase.
3. Criar as tabelas principais.
4. Cadastrar uma partida inicial.
5. Cadastrar os dois times.
6. Criar login simples.
7. Criar tela do organizador.
8. Criar tela dos grupos.
9. Fazer o grupo visualizar a rodada atual.
10. Fazer o grupo enviar resposta.
11. Fazer o organizador visualizar respostas.
12. Criar campos de nota manual.
13. Criar botões de adicionar pontos.
14. Atualizar placar.
15. Registrar eventos básicos.
16. Testar o fluxo completo do Júri Popular.
17. Testar o fluxo simplificado do Clash.
```

Essa ordem evita começar por funcionalidades avançadas antes de o sistema conseguir executar o ciclo principal da gincana.

---

## 14. Melhorias futuras

Depois do MVP, podem ser implementadas as seguintes melhorias:

## 14.1 Colaboração interna dos grupos

```txt
chat interno por grupo;
mural de ideias;
múltiplos usuários por equipe;
capitão;
bloqueio de envio final para membros comuns.
```

Essa melhoria pode ser útil caso os grupos participem de vários computadores ou em laboratórios separados.

## 14.2 Modo apresentação

```txt
botão para aumentar fontes;
ocultar controles administrativos;
destacar placar;
destacar respostas e resultados;
deixar a tela mais adequada à projeção.
```

Mesmo sem rota separada para projetor, o modo apresentação pode deixar a tela do organizador mais limpa.

## 14.3 IA avaliadora

```txt
avaliação automática de respostas;
feedback pedagógico;
sugestão de nota;
sugestão de vencedor;
geração de perguntas.
```

## 14.4 Clash completo

```txt
cadastro de duelistas;
duelista ativo;
eliminação;
passa e repassa;
multiplicador de pontuação;
timer;
chance de resposta do oponente.
```

## 14.5 Atualização em tempo real

```txt
Supabase Realtime;
atualização automática do placar;
atualização automática das respostas;
sincronização entre tela do grupo e tela do organizador.
```

---

## 15. Considerações logísticas

Como existe preocupação com um grupo ouvir a argumentação do outro, há duas soluções possíveis:

```txt
separar fisicamente os grupos, por exemplo em laboratórios diferentes;
implementar futuramente um modo silencioso com chat interno/mural de ideias.
```

Para o MVP, a alternativa mais simples é tentar resolver a questão logisticamente, usando espaços separados quando possível.

A solução tecnológica, com chat interno e bloqueio de discussão oral, pode ser pensada depois.

---

## 16. Conclusão

O MVP do sistema web deve ser simples, funcional e controlável. O objetivo não é implementar a versão perfeita da gincana logo no início, mas criar uma base que permita executar a atividade.

A primeira versão deve priorizar:

```txt
login simples;
tela do organizador;
tela dos grupos;
rodadas;
respostas;
notas manuais;
placar;
eventos.
```

Com isso funcionando, o projeto já poderá ser usado em uma situação real, especialmente se os grupos estiverem organizados em computadores ou espaços separados.

As funcionalidades mais complexas, como chat interno, IA avaliadora, modo apresentação, Realtime e Clash completo, devem ser tratadas como evolução posterior.
