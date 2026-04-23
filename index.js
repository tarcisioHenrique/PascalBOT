const mensagem = require("./openai.js");
require("dotenv").config();

const timersSimulado = new Map(); // guarda os timers ativos por aluno

//Importa a Classe DbVerification para consultas de registro no Banco de Dados
const { DbVerification, Xp, TorreDeVidro } = require("./db-verification.js");
const db = new DbVerification();
const xpManager = new Xp();
const torre = new TorreDeVidro();

//Importa o whatsappweb.js
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

//Importa o sharp
const sharp = require("sharp");

//Importa o supabase
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

//Importa o qrcode terminal
const qrcode = require("qrcode-terminal");

// Timer
const startupTime = Math.floor(Date.now() / 1000);

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  await db.resetAllEstados();
  console.log("Bot pronto!");
});

// ========================
// FUNÇÕES AUXILIARES
// ========================

//Constante do XP
const XP_CONSTANT = 50;

//======== PEGA A IMAGEM DE PERFIL DO ALUNO E TENTA SALVAR NO CACHE DO SERVER
const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const { loadImage, createCanvas, registerFont } = require("canvas");
const CACHE_DIR = path.join(__dirname, "avatars_cache");

//Muda o tamanho do ícone
async function resizeAvatar(base64Image) {
  const buffer = Buffer.from(base64Image, "base64");
  const resized = await sharp(buffer)
    .resize(50, 50, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  return resized.toString("base64");
}

//Importa as fontes para a imagem - descomentar apenas quando subir para a vps
// registerFont('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', { family: 'DejaVu Sans', weight: 'bold' });
// registerFont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', { family: 'DejaVu Sans' });

//FUNÇÃO PARA GERAR A IMAGEM DO RANKING
const LEADERBOARD_WIDTH = 800;
const ROW_HEIGHT = 70;
const HEADER_HEIGHT = 80;
const AVATAR_SIZE = 50;

async function generateRankingImage(rankingData) {
  const canvasHeight = HEADER_HEIGHT + rankingData.length * ROW_HEIGHT;
  const canvas = createCanvas(LEADERBOARD_WIDTH, canvasHeight);
  const ctx = canvas.getContext("2d");

  const fontFamily = process.platform === "win32" ? "Arial" : "DejaVu Sans";
  const boldFontFamily = process.platform === "win32" ? "Arial" : "DejaVu Sans";

  // Fundo escuro geral
  ctx.fillStyle = "#1e1e2f";
  ctx.fillRect(0, 0, LEADERBOARD_WIDTH, canvasHeight);

  // Cabeçalho
  ctx.fillStyle = "#2d2d44";
  ctx.fillRect(0, 0, LEADERBOARD_WIDTH, HEADER_HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 28px "${boldFontFamily}"`;
  ctx.fillText("📊 Ranking - PascalBOT", 20, 50);

  for (let i = 0; i < rankingData.length; i++) {
    const aluno = rankingData[i];
    const y = HEADER_HEIGHT + i * ROW_HEIGHT;

    // 1. Fundo zebrado (atrás de tudo)
    ctx.fillStyle = i % 2 === 0 ? "#252536" : "#2a2a3b";
    ctx.fillRect(0, y, LEADERBOARD_WIDTH, ROW_HEIGHT);

    // 2. Avatar (ou placeholder)
    if (aluno.avatar) {
      try {
        const avatarBuffer = Buffer.from(aluno.avatar, "base64");
        const avatarImage = await loadImage(avatarBuffer);
        ctx.drawImage(avatarImage, 20, y + 10, AVATAR_SIZE, AVATAR_SIZE);
      } catch (err) {
        console.error("Erro ao carregar avatar:", err);
        drawPlaceholder(ctx, 20, y + 10, AVATAR_SIZE);
      }
    } else {
      drawPlaceholder(ctx, 20, y + 10, AVATAR_SIZE);
    }

    // 3. Medalha / posição
    ctx.font = `bold 24px "${boldFontFamily}"`;
    if (i === 0) ctx.fillStyle = "#FFD700";
    else if (i === 1) ctx.fillStyle = "#C0C0C0";
    else if (i === 2) ctx.fillStyle = "#CD7F32";
    else ctx.fillStyle = "#ffffff";
    ctx.fillText(`${i + 1}º`, 90, y + 38);

    // 4. Nome
    ctx.font = `bold 18px "${fontFamily}"`;
    ctx.fillStyle = "#f0f0f0";
    const nome =
      aluno.username.length > 25
        ? aluno.username.substring(0, 22) + "..."
        : aluno.username;
    ctx.fillText(nome, 150, y + 32);

    // 5. Nível
    ctx.font = `bold 16px "${fontFamily}"`;
    ctx.fillStyle = "#a0a0c0";
    ctx.fillText(`Nível ${aluno.level}`, 450, y + 32);

    // 6. Pontuação
    ctx.font = `18px "${fontFamily}"`;
    ctx.fillStyle = "#FFD966";
    ctx.fillText(`${aluno.pontuacao} pts`, 600, y + 32);
  }

  return canvas.toBuffer();
}

// Função auxiliar fora do loop
function drawPlaceholder(ctx, x, y, size) {
  ctx.fillStyle = "#CCCCCC";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#333333";
  ctx.font = `bold ${size * 0.6}px "Segoe UI", "Arial"`;
  ctx.fillText("?", x + size * 0.35, y + size * 0.7);
}

function iniciarTimerPergunta(whatsappNumber, dificuldade) {
  // Cancela timer anterior, se existir
  if (timersSimulado.has(whatsappNumber)) {
    clearTimeout(timersSimulado.get(whatsappNumber));
  }

  const tempoLimite =
    { facil: 30, medio: 45, dificil: 60, infernal: 90, morte: 120 }[
      dificuldade
    ] || 60;

  const timer = setTimeout(async () => {
    timersSimulado.delete(whatsappNumber);
    // Chama a função que trata o timeout (aplica penalidade, avança pergunta, etc.)
    await tratarTimeoutSimulado(whatsappNumber);
  }, tempoLimite * 1000);

  timersSimulado.set(whatsappNumber, timer);
}

async function tratarTimeoutSimulado(whatsappNumber) {
  // Busca o estado atual do aluno
  const { data: estado, error } = await supabase
    .from("estados")
    .select("dados")
    .eq("whatsappNumber", whatsappNumber)
    .single();
  if (error || !estado || estado.estado !== "TORRE") return;

  let dados = estado.dados;

  // Aplica penalidade (15% do acumulado)
  const penalidadeXP = Math.floor(dados.xp_acumulado * 0.15);
  const penalidadeCoins = Math.floor(dados.coins_acumuladas * 0.15);
  dados.xp_acumulado = Math.max(0, dados.xp_acumulado - penalidadeXP);
  dados.coins_acumuladas = Math.max(
    0,
    dados.coins_acumuladas - penalidadeCoins,
  );

  // Avança índice
  dados.indice++;
  const terminou = dados.indice >= dados.perguntas.length;

  let mensagem = `⏰ *Tempo esgotado!* Você demorou mais de ${tempoLimite} segundos.\nPerdeu ${penalidadeXP} XP e ${penalidadeCoins} coins.`;

  if (terminou) {
    // Finaliza simulado
    const xpTotal = Math.floor(dados.xp_acumulado * dados.multiplicador);
    const coinsTotal = Math.floor(dados.coins_acumuladas * dados.multiplicador);
    // ... adiciona recompensa, atualiza estatísticas, etc.
    await supabase
      .from("estados")
      .update({ estado: "IDLE", dados: {} })
      .eq("whatsappNumber", whatsappNumber);
    mensagem += `\n\n🏆 *Simulado concluído!*\nAcertos: ${dados.acertos}/${dados.perguntas.length}\nXP: ${xpTotal}\nCoins: ${coinsTotal}`;
    await client.sendMessage(whatsappNumber, mensagem);
  } else {
    // Salva o progresso
    await supabase
      .from("estados")
      .update({ dados: dados, ultima_atividade: new Date().toISOString() })
      .eq("whatsappNumber", whatsappNumber);

    // Envia a próxima pergunta
    const proxima = dados.perguntas[dados.indice];
    const letras = ["a", "b", "c", "d"];
    let perguntaStr = `📖 *Pergunta ${dados.indice + 1} de ${dados.perguntas.length}*\n\n${proxima.texto}\n\n`;
    proxima.alternativas.forEach((alt, idx) => {
      perguntaStr += `${letras[idx]}) ${alt}\n`;
    });
    perguntaStr += "\nResponda com a letra (a, b, c, d).";

    await client.sendMessage(whatsappNumber, mensagem); // feedback do timeout
    await client.sendMessage(whatsappNumber, perguntaStr);

    // Inicia novo timer para a próxima pergunta
    iniciarTimerPergunta(whatsappNumber, dados.dificuldade);
  }
}

async function iniciarDiaria(message) {
  const contact = await message.getContact();
  const numero = contact.number; // identificador completo

  const resultado = await xpManager.gerarPerguntaDiaria(numero);
  console.log("Dados retornados por gerarPerguntaDiaria:", resultado);

  if (resultado.jaRespondeuHoje) {
    await message.reply(
      "📅 Você já respondeu a pergunta diária hoje! Volte amanhã para ganhar mais XP e Jeane Coins!",
    );
    return;
  }

  if (resultado.error) {
    console.error(resultado.error);
    await message.reply(
      "❌ Erro ao carregar a pergunta diária. Reporte ao administrador.",
    );
    return;
  }

  // Atualiza estado para DIARIA (os dados da pergunta já foram salvos em gerarPerguntaDiaria)
  console.log("Antes do updateEstado - estado atual será alterado para DIARIA");
  await db.updateEstado(numero, "DIARIA");

  // Formata a pergunta para envio
  const letras = ["a", "b", "c", "d"];
  let perguntaMsg = `📅 *Pergunta Diária*\n\n${resultado.pergunta}\n\n`;
  resultado.alternativas.forEach((alt, idx) => {
    perguntaMsg += `${letras[idx]}. ${alt}\n`;
  });
  perguntaMsg += "\nResponda com a **letra** da alternativa correta.";

  await message.reply(perguntaMsg);
}

async function processarDiaria(message, estadoObj) {
  console.log("EstadoObj completo recebido:", estadoObj);
  console.log("Campo dados:", estadoObj.dados);
  console.log("diaria_atual:", estadoObj.dados?.diaria_atual);

  const contact = await message.getContact();
  const numero = contact.number;
  const dados = estadoObj.dados || {};
  const diariaAtual = dados.diaria_atual;

  if (!diariaAtual) {
    await db.updateEstado(numero, "IDLE", {});
    await message.reply(
      "⚠️ Nenhuma pergunta diária ativa. Use /diaria para começar.",
    );
    return;
  }

  const respostaAluno = message.body.trim().toLowerCase();
  let indiceResposta = -1;

  // Converte letra (a,b,c,d) ou número (1,2,3,4) para índice
  if (["a", "b", "c", "d"].includes(respostaAluno)) {
    indiceResposta = respostaAluno.charCodeAt(0) - 97;
  } else if (["1", "2", "3", "4"].includes(respostaAluno)) {
    indiceResposta = parseInt(respostaAluno) - 1;
  }

  if (indiceResposta < 0 || indiceResposta >= diariaAtual.alternativas.length) {
    await message.reply(
      "❌ Resposta inválida. Responda com a **letra** (a, b, c, d) ou o **número** (1, 2, 3, 4).",
    );
    return;
  }
  const respostaCorreta = Number(diariaAtual.resposta);
  const acertou = indiceResposta === respostaCorreta;
  let mensagemFinal = "";

  if (acertou) {
    const xpGanho = diariaAtual.xp_base * 1.5;
    const coinsGanhas = diariaAtual.jeane_coins_base * 1.5;
    await xpManager.adicionarRecompensa(
      numero,
      diariaAtual.xp_base,
      diariaAtual.jeane_coins_base,
      "diaria",
    );
    mensagemFinal = `✅ *Resposta correta!*\nVocê ganhou **${xpGanho} XP** e **${coinsGanhas} Jeane Coins**!`;
  } else {
    const respostaCorretaLetra = String.fromCharCode(97 + diariaAtual.resposta);
    const respostaCorretaTexto = diariaAtual.alternativas[diariaAtual.resposta];
    const letras = ["a", "b", "c", "d"];
    const idxCorreto = Number(diariaAtual.resposta);
    const letraCorreta = letras[idxCorreto] || "?";
    const textoCorreto =
      diariaAtual.alternativas[idxCorreto] || "(não encontrado)";
    mensagemFinal = `❌ *Resposta errada!*\nA alternativa correta era *${letraCorreta}) ${textoCorreto}*\n\nNão desanime! Amanhã tem outra chance.`;
  }

  console.log("Índice da resposta do aluno (indiceResposta):", indiceResposta);
  console.log("Valor bruto de diariaAtual.resposta:", diariaAtual.resposta);
  console.log("Tipo do diariaAtual.resposta:", typeof diariaAtual.resposta);
  console.log("Conversão para número:", Number(diariaAtual.resposta));

  // Limpa dados da diária e volta para IDLE
  const novosDados = { ...dados };
  delete novosDados.diaria_atual;
  await db.updateEstado(numero, "IDLE", novosDados);

  await message.reply(mensagemFinal);
}

//=========================
// TEXTO DO MENU
//=========================

const MENU_TEXT = `
🌟 Bem-vindo(a) ao PascalBOT! 🌟

Seu assistente pessoal de Língua Portuguesa – estude, treine e ganhe recompensas!

Use os comandos abaixo para navegar:

📚 /estudar – Converse comigo, tire dúvidas e aprenda no seu ritmo.
📅 /diaria – Responda uma pergunta por dia e ganhe XP e Jeane Coins extras!
🏰 /torre – Enfrente simulados de diferentes dificuldades e acumule pontos.
👤 /perfil – Veja seu nível, XP e Jeane Coins.
🏆 /ranking – Descubra quem está no topo da turma.
👥 /editarnome - Mude o seu nome. Digite o comando com o nome desejado na mesma mensagem Ex.: /editarnome Tarcisio
📸 /foto - Adicione ou Mude sua foto de perfil do PascalBOT. 
🛒 /loja – Troque suas Jeane Coins por vantagens (em breve).
❓ /menu – Mostra esta mensagem novamente.

Bons estudos! ✨
    `;

// ========================
// HANDLER PRINCIPAL
// ========================

client.on("message", async (message) => {
  // IDENTIFICADOR ÚNICO (padronizado)
  const contact = await message.getContact();
  const numero = contact.number;

  //Habilitar somente para testes: faz com que somente o meu número use o Pascal
/*   const NUMERO_AUTORIZADO = process.env.NUMERO_AUTORIZADO;
  if (numero !== NUMERO_AUTORIZADO) {
    message.reply(
      "Olá, estou em manutenção agora! Por favor, volte mais tarde.",
    );
    return; // ignora qualquer mensagem de outros números
  }
 */
  // Ignora mensagens antigas (enquanto bot estava off)
  if (message.timestamp < startupTime) return;

  // Ignora notificações e status
  if (message.type === "e2e_notification" || message.type === "notification")
    return;
  if (message.isStatus) return;

  // Ignora mensagens de grupos
  const chat = await message.getChat();
  if (chat.isGroup) return;

  // --- PROCESSAR ENVIO DE FOTO DE PERFIL ---
  if (message.hasMedia && !message.body.startsWith("/")) {
    console.log("Caiu no if message has media");
    const { data: aguardando, error } = await supabase
      .from("aguardando_foto")
      .select("*")
      .eq("whatsappNumber", numero)
      .single();

    console.log("2. Resultado select:", { aguardando, error });

    if (aguardando) {
      try {
        const media = await message.downloadMedia();
        if (!media.mimetype.startsWith("image/")) {
          await message.reply("❌ Por favor, envie uma *imagem* (JPEG, PNG).");
          // Não limpa o estado, para que possa tentar novamente
          return;
        }

        // Redimensiona a imagem
        const avatarBase64 = await resizeAvatar(media.data);

        // Salva no banco
        const { error: updateError } = await supabase
          .from("id_student")
          .update({ avatar: avatarBase64 })
          .eq("whatsappNumber", numero);

        if (updateError) throw updateError;

        // Remove o estado "aguardando"
        await supabase
          .from("aguardando_foto")
          .delete()
          .eq("whatsappNumber", numero);

        await message.reply(
          "✅ *Foto atualizada com sucesso!* Agora ela aparecerá no ranking.",
        );
        return; // Importante: não processa mais nada
      } catch (error) {
        console.error("Erro ao processar foto:", error);
        await message.reply(
          "❌ Ocorreu um erro ao processar sua foto. Tente novamente.",
        );
        return;
      }
    }
  }
  // --- FIM DO BLOCO DE FOTO ---

  // Verifica/cadastra aluno na tabela id_student
  const { data: studentData, error: studentError } =
    await db.studentVerification(numero);
  if (studentError) {
    console.error("Erro ao verificar aluno:", studentError);
    return;
  }

  // Se aluno não existe, cadastra
  if (!studentData || studentData.length === 0) {
    const newStudent = {
      username: message._data.notifyName || "Aluno",
      whatsappNumber: numero,
    };
    const { error: insertStudentError } = await supabase
      .from("id_student")
      .insert([newStudent]);
    if (insertStudentError) {
      console.error("Erro ao cadastrar aluno:", insertStudentError);
      return;
    }
    const initialProgress = {
      id_aluno: numero,
      xp: 0,
      level: 1,
      jeane_coins: 0,
      status: "MENU",
    };
    await supabase.from("id_lvlprogress").insert([initialProgress]);
    // Mensagem de boas-vindas
    await message.reply(
      "Olá! Seja bem-vindo ao PascalBOT! Digite /menu para começar.",
    );

    const estadoInicial = {
      whatsappNumber: numero, // use o número completo (message.from)
      estado: "IDLE",
      dados: {},
      ultima_atividade: new Date().toISOString(),
    };
    const { error: estadoError } = await supabase
      .from("estados")
      .upsert([estadoInicial], { onConflict: "whatsappNumber" });
    if (estadoError)
      console.error("Erro ao criar estado inicial:", estadoError);

    return;
  }

  // Obtém estado atual do aluno
  const estadoObj = await db.getEstado(numero);
  const estadoAtual = estadoObj?.estado || "IDLE";

  // ========================
  // TRATAMENTO DE ESTADOS ESPECIAIS
  // ========================
  if (estadoAtual === "DIARIA") {
    await processarDiaria(message, estadoObj);
    return;
  }

  if (estadoAtual === "ESTUDO") {
    // Se for comando de sair
    if (message.body.trim().toLowerCase() === "/sair") {
      await db.updateEstado(numero, "IDLE", {});
      await message.reply("Modo Estudo encerrado.");
      await message.reply(MENU_TEXT);
      return;
    }
    // Se for qualquer outro comando, ignora (ou poderia permitir outros comandos, mas melhor manter foco)
    if (message.body.startsWith("/")) {
      await message.reply(
        "Você está em modo Estudo. Digite /sair para voltar ao menu.",
      );
      return;
    }
    // Envia para OpenAI
    const resposta = await mensagem(message.body);
    await message.reply(resposta);
    return;
  }

  console.log(
    "Valor do estado antes de entrar no bloco da torre: ",
    estadoAtual,
  );
  if (estadoAtual === "TORRE") {
    console.log("Módulo torre ativado!");

    // Se o aluno enviar "/sair", cancela o simulado
    if (message.body.trim().toLowerCase() === "/sair") {
      await db.updateEstado(numero, "IDLE", {});
      await message.reply("Simulado cancelado. Volte ao menu com /menu.");
      return;
    }
    // Processa a resposta
    const resposta = await torre.processarRespostaTorre(numero, message.body);
    if (resposta.error) {
      await message.reply(`❌ ${resposta.error}`);
      return;
    }
    // Cancelar o timer atual (pois o aluno respondeu)
    if (timersSimulado.has(numero)) {
      clearTimeout(timersSimulado.get(numero));
      timersSimulado.delete(numero);
    }

    if (resposta.terminou) {
      await message.reply(resposta.mensagem);
      // Timer não precisa ser reiniciado
    } else {
      // Envia feedback (se houver) e a próxima pergunta
      if (resposta.feedback) await message.reply(resposta.feedback);
      await message.reply(resposta.mensagem);
      // INICIAR TIMER PARA A PRÓXIMA PERGUNTA
      // Precisamos saber a dificuldade – você pode obtê-la do estado ou guardar em memória
      const estadoAtualObj = await db.getEstado(numero);
      const dificuldadeAtual = estadoAtualObj?.dados?.dificuldade;
      if (dificuldadeAtual) iniciarTimerPergunta(numero, dificuldadeAtual);
    }
    return;
  }

  // ========================
  // ESTADO IDLE (ou outros) – processa comandos
  // ========================
  if (message.body.startsWith("/")) {
    const comandoCompleto = message.body.toLowerCase().trim();
    const comandoBase = comandoCompleto.split(" ")[0]; // ex: "/torre"
    const args = comandoCompleto.split(" ").slice(1); // argumentos
    switch (comandoBase) {
      case "/menu":
        await message.reply(MENU_TEXT);
        break;
      case "/perfil":
        const progresso = await db.getStudentProgress(numero);
        const nivelAtual = progresso.data[0].level;
        const xpAtual = progresso.data[0].xp;
        const xpProximoNivel = XP_CONSTANT * Math.pow(nivelAtual + 1, 2);
        const xpFaltando = xpProximoNivel - xpAtual;
        if (progresso?.data?.[0]) {
          await message.reply(
            `Saudações, *${studentData[0].username}*!\n*Nível*: ${progresso.data[0].level}\n*XP*: ${progresso.data[0].xp}\n*Jeane Coins*: ${progresso.data[0].jeane_coins}\n*Xp para o Próximo Nível: ${xpFaltando}*`,
          );
        } else {
          await message.reply(
            "Erro ao carregar seu progresso. Tente novamente.",
          );
        }
        break;
      case "/estudar":
        await db.updateEstado(numero, "ESTUDO", { historico: [] });
        await message.reply(
          "Modo Estudo ativado! Envie suas dúvidas. Digite /sair para encerrar.",
        );
        break;
      case "/diaria":
        await iniciarDiaria(message);
        break;
      case "/torre":
        const args = message.body.trim().split(" ");
        const dificuldade = args[1] ? args[1].toLowerCase() : null;
        if (
          !["facil", "medio", "dificil", "infernal", "morte"].includes(
            dificuldade,
          )
        ) {
          await message.reply(
            "Escolha uma dificuldade: `/torre facil`, `/torre medio`, `/torre dificil`, `/torre infernal` ou `/torre morte`.",
          );
          break;
        }

        const { data: progressoTorre, error: progError } = await supabase
          .from("id_lvlprogress")
          .select("torre_nivel_max")
          .eq("id_aluno", numero)
          .single();

        const nivelLiberado = progressoTorre?.torre_nivel_max || "facil";
        const ordem = ["facil", "medio", "dificil", "infernal", "morte"];
        if (ordem.indexOf(dificuldade) > ordem.indexOf(nivelLiberado)) {
          await message.reply(
            `🔒 Dificuldade *${dificuldade}* ainda não liberada! Complete a dificuldade *${nivelLiberado}* com pelo menos 75% de acertos para desbloquear a próxima.`,
          );
          break;
        }

        const result = await torre.iniciarTorre(numero, dificuldade);
        if (result.error) {
          await message.reply(`❌ ${result.error}`);
          break;
        }
        // Enviar primeira pergunta
        const primeiraPergunta = result.dados.perguntas[0];
        const letras = ["a", "b", "c", "d"];
        let perguntaMsg = `🏰 *Torre de Vidro - ${dificuldade.toUpperCase()}*\n\n📖 *Pergunta 1 de ${result.dados.perguntas.length}*\n\n${primeiraPergunta.texto}\n\n`;
        primeiraPergunta.alternativas.forEach((alt, idx) => {
          perguntaMsg += `${letras[idx]}) ${alt}\n`;
        });
        perguntaMsg += "\nResponda com a letra (a, b, c, d).";
        await message.reply(perguntaMsg);
        iniciarTimerPergunta(numero, dificuldade);

        break;

      // Outros comandos: /loja (futuro)

      case "/ranking":
        try {
          const ranking = await db.obterRanking();
          if (!Array.isArray(ranking) || ranking.length === 0) {
            await message.reply(
              "Ainda não há dados suficientes para gerar o ranking.",
            );
            break;
          }
          // Remove qualquer possível null residual (segurança)
          const rankingValido = ranking.filter(
            (item) => item && item.whatsappNumber,
          );
          if (rankingValido.length === 0) {
            await message.reply("Nenhum aluno válido encontrado.");
            break;
          }
          const rankingComId = rankingValido.map((aluno) => ({
            username: aluno.username,
            level: aluno.level,
            pontuacao: aluno.pontuacao,
            contactId: aluno.whatsappNumber,
            avatar: aluno.avatar,
          }));
          const imageBuffer = await generateRankingImage(rankingComId);
          const media = new MessageMedia(
            "image/png",
            imageBuffer.toString("base64"),
          );
          await client.sendMessage(message.from, media, {
            caption: "🏆 Ranking atualizado! 🏆",
          });
        } catch (err) {
          console.error("Erro ao gerar ranking imagem:", err);
          await message.reply(
            "Ocorreu um erro ao gerar o ranking. Tente novamente mais tarde.",
          );
        }
        break;
      case "/editarnome":
        const novoNome = message.body.slice("/editarnome".length).trim();
        if (!novoNome) {
          await message.reply(
            "❌ Use o formato: `/editarnome Seu Nome Completo`",
          );
          break;
        }
        // Atualizar nome no banco
        const { error: updateError } = await supabase
          .from("id_student")
          .update({ username: novoNome })
          .eq("whatsappNumber", numero); // use seu identificador
        if (updateError) {
          console.error(updateError);
          await message.reply("❌ Erro ao atualizar nome. Tente novamente.");
        } else {
          await message.reply(
            `✅ Nome alterado para *${novoNome}* com sucesso!`,
          );
        }
        break;

      case "/foto":
        // Marca que o aluno está aguardando enviar foto
        await supabase
          .from("aguardando_foto")
          .upsert({ whatsappNumber: numero }, { onConflict: "whatsappNumber" });
        await message.reply(
          "📸 *Envie sua foto de perfil!*\n\nEnvie uma imagem para usar no ranking (você pode mandar uma selfie ou qualquer foto). Vamos redimensioná-la automaticamente.",
        );
        break;

      default:
        await message.reply(
          "Comando não reconhecido. Digite /menu para ver as opções.",
        );
    }
  } else {
    // Se não for comando e não estiver em estado especial, apenas sugere menu
    await message.reply("Digite /menu para ver as opções disponíveis.");
  }
});

client.initialize();
