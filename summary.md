# Resumo do PascalBOT

## Visao geral

O projeto implementa um bot educacional para WhatsApp usando `whatsapp-web.js`. Ele atende estudantes com recursos de estudo de portugues, gamificacao, perfil, ranking, loja, inventario, perguntas diarias e simulados em formato de "Torre de Vidro".

A persistencia principal fica no Supabase. As tabelas acessadas pelo codigo incluem, entre outras, `id_student`, `id_lvlprogress`, `estados`, `perguntas`, `estatisticas_aluno`, `estatisticas_topicos`, `loja_itens`, `inventario_aluno`, `buffs_ativos`, `habilidades_usos`, `historico_perguntas_aluno` e `aguardando_foto`.

A OpenAI e usada em tres pontos principais:

- modo estudo, com conversa contextual e historico curto;
- geracao de plano semanal personalizado com base nas estatisticas do aluno;
- avaliacao de respostas abertas nas dificuldades mais altas da Torre.

## Arquivos analisados

### `index.js`

E o arquivo principal da aplicacao. Ele:

- carrega dependencias, configura Supabase, OpenAI e WhatsApp;
- inicializa o cliente do WhatsApp com `LocalAuth`;
- exibe QR code no terminal;
- reseta estados quando o bot fica pronto;
- centraliza o roteamento das mensagens recebidas;
- controla estados conversacionais como `IDLE`, `ESTUDO`, `TORRE`, `DIARIA`, `LOJA`, `INVENTARIO`, `PERFIL_MENU` e `PERFIL_EDITANDO`;
- implementa comandos como `/menu`, `/perfil`, `/estudar`, `/diaria`, `/torre`, `/ranking`, `/plano`, `/editarnome`, `/foto`, `/loja`, `/dica` e `/pular`;
- gera imagens de perfil e ranking;
- processa loja, inventario, compra, equipamento de titulos/habilidades e buffs;
- gerencia timer de perguntas da Torre.

O arquivo esta fazendo muita coisa ao mesmo tempo: bot WhatsApp, regras de negocio, renderizacao de imagem, chamadas de IA, controle de estado e acesso direto ao banco.

### `db-verification.js`

Concentra a maior parte da camada de dados e logica de gamificacao. Ele exporta:

- `DbVerification`, com metodos para buscar aluno, progresso, estado, ranking, perfil, loja, inventario, estatisticas e configuracoes;
- `Xp`, com logica de diaria, buffs, XP, moedas e level;
- `TorreDeVidro`, com busca de perguntas, montagem de andares, embaralhamento de alternativas, processamento de respostas e avaliacao aberta via OpenAI;
- `montarPerguntaString`, para formatar perguntas;
- `possuiHabilidade`, para checar habilidades compradas na loja.

Apesar do nome `db-verification`, o arquivo vai bem alem de verificacao de banco. Ele contem regras importantes do jogo, fluxo da Torre e calculos de recompensa.

### `openai.js`

E um wrapper simples para uma chamada de chat da OpenAI. Ele cria um cliente com `OPENAI_API_KEY` e exporta a funcao `mensagem(pergunta)`, usando `gpt-4o-mini` com um prompt de assistente estudantil.

No estado atual, parece haver sobreposicao com `mensagemComContexto` em `index.js`, que tambem cria cliente OpenAI e tambem define prompt educacional.

## Fluxo do sistema

1. O bot inicia, carrega variaveis de ambiente e conecta no WhatsApp.
2. Ao ficar pronto, chama `resetAllEstados()` e limpa os estados ativos.
3. Cada mensagem recebida passa por filtros iniciais, mapeamento de numero e consulta do estado atual no Supabase.
4. Se o aluno esta em um estado especial, a mensagem e encaminhada ao processador daquele modo.
5. Se esta fora de um modo especial e manda um comando, o `switch` principal executa a acao.
6. As recompensas, inventario, ranking e perfil sao calculados a partir das tabelas do Supabase.
7. Recursos de IA sao usados para estudo livre, plano personalizado e respostas abertas.

## Pontos fortes

- O sistema tem uma proposta clara: tutor educacional com gamificacao.
- Usa maquina de estados persistida no banco, o que permite continuar fluxos entre mensagens.
- Tem recursos motivacionais interessantes: XP, moedas, ranking, loja, titulos, habilidades e buffs.
- A Torre tem mecanicas mais ricas que um quiz simples: vidas, streak, andares, dificuldade, historico de perguntas e habilidades especiais.
- O plano de estudo usa dados reais de desempenho por topico.
- Ha cuidado com usuarios reais do WhatsApp, incluindo tentativa de mapear IDs `@lid` para numero.

## Problemas e riscos encontrados

### Organizacao

- `index.js` esta grande demais e mistura responsabilidades. Seria melhor separar em modulos: comandos, estados, loja, perfil, imagens, diaria, torre e servicos externos.
- `db-verification.js` tambem mistura acesso a banco com regras de jogo. O nome do arquivo ja nao representa bem o conteudo.
- Ha logicas duplicadas, especialmente compra/equipamento/loja e comandos como `/dica` e `/pular`, que aparecem em mais de um fluxo.

### Bugs provaveis

- Em `index.js`, `require("dotenv").config()` vem depois da criacao do cliente OpenAI. Se a variavel ainda nao estiver carregada pelo ambiente externo, `OPENAI_API_KEY` pode chegar vazia.
- Em `db-verification.js`, `verifyXP()` usa `.maybemaybeSingle()`, que parece um typo e deve quebrar se essa funcao for chamada.
- O controle de timeout da Torre parece inconsistente: em `processarRespostaTorre`, `timestampPergunta` e atualizado para o horario atual antes de calcular `tempoDecorrido`, o que tende a impedir timeout real.
- Existem estados com caixa diferente, como `IDLE` e `idle`. O reset geral usa `idle`, enquanto varios fluxos usam `IDLE`. Isso pode gerar comportamento estranho.
- `updateEstado()` faz `update`, nao `upsert`. Se o aluno nao tiver linha em `estados`, a atualizacao nao cria registro.
- Em `gerarPerguntaDiaria`, a condicao `!perguntas.length === 0` parece incorreta. O esperado provavelmente seria `perguntas.length === 0`.
- Em `gerarMensagemInventario`, o select nao busca `loja_itens.id`, mas depois tenta usar `item.loja_itens.id`.
- A dificuldade passada em `/torre facil|medio|...` e validada, mas `iniciarTorre()` monta sempre os cinco andares com todas as dificuldades. Isso pode ser intencional, mas torna o argumento de dificuldade meio enganoso.

### Confiabilidade de dados

- Compras deduzem moedas e depois inserem inventario em chamadas separadas. Sem transacao/RPC, pode haver inconsistencia se a segunda etapa falhar.
- Algumas operacoes fazem `maybeSingle()` e depois acessam propriedades sem checar se o objeto existe.
- O uso de `SUPABASE_ANON_KEY` em um processo de servidor pode funcionar, mas se houver operacoes privilegiadas talvez seja melhor usar uma chave de servico com politicas bem controladas.

### Experiencia e manutencao

- Varios textos aparecem com caracteres quebrados, provavelmente por problema de encoding. Isso prejudica mensagens do bot e legibilidade do codigo.
- Ha muitos `console.log` de debug em fluxo de producao, incluindo dados de usuario e respostas.
- Alguns prompts e mensagens estao duplicados entre `index.js` e `openai.js`.
- Nao vi separacao clara entre configuracao, constantes e regras de recompensa.
- O projeto se beneficiaria de testes pequenos para calculo de XP, estados, respostas da Torre, compra e geracao de diaria.

## Melhorias recomendadas

1. Corrigir bugs imediatos:
   - carregar `.env` antes de criar clientes;
   - trocar `.maybemaybeSingle()` por `.maybeSingle()`;
   - padronizar estados para uma unica convencao, por exemplo sempre `IDLE`;
   - ajustar o timeout da Torre para comparar contra o timestamp salvo antes de atualiza-lo;
   - corrigir a condicao da diaria;
   - garantir que `updateEstado()` crie estado quando nao existir.

2. Separar responsabilidades:
   - `services/openai-service.js`;
   - `services/supabase.js`;
   - `commands/*.js`;
   - `features/torre.js`;
   - `features/loja.js`;
   - `features/perfil.js`;
   - `features/diaria.js`;
   - `render/profile-image.js`;
   - `render/ranking-image.js`.

3. Centralizar constantes:
   - dificuldades;
   - tempos por dificuldade;
   - recompensas;
   - nomes de estados;
   - nomes de habilidades;
   - textos de menu.

4. Criar uma camada de repositorio para Supabase:
   - evitar queries repetidas espalhadas;
   - padronizar tratamento de erro;
   - facilitar testes;
   - reduzir risco de inconsistencias entre tabelas.

5. Transformar operacoes criticas em RPC/transacao:
   - compra de item;
   - recompensa de XP/moedas;
   - finalizacao de Torre;
   - uso de habilidades com limite diario.

6. Melhorar uso da OpenAI:
   - manter um unico cliente OpenAI;
   - reaproveitar um unico servico para prompts;
   - validar JSON retornado no plano de estudos com fallback mais robusto;
   - considerar modelo/configuracao por caso de uso.

7. Adicionar testes e checks:
   - `node --check index.js db-verification.js openai.js`;
   - testes unitarios para XP, level, compra, habilidades e Torre;
   - testes de estados para entradas como `/sair`, `/voltar`, `/dica`, `/pular`;
   - fixtures de perguntas para validar alternativas e respostas.

## Conclusao

O PascalBOT ja tem uma base funcional e ambiciosa: ele nao e apenas um chatbot, mas um sistema educacional gamificado com persistencia, progressao, loja, ranking e IA. O maior ganho agora seria estabilizar os bugs provaveis e modularizar o codigo. Isso deixaria mais facil evoluir o bot sem quebrar fluxos importantes, especialmente Torre, diaria, loja e perfil.

Minha leitura e que o sistema esta em uma fase de prototipo avancado: muita funcionalidade ja existe, mas a manutencao comeca a ficar dificil porque as responsabilidades cresceram dentro de poucos arquivos.
