const mensagem = require("./openai.js");
require('dotenv').config();

//Importa a Classe DbVerification para consultas de registro no Banco de Dados
const { DbVerification, Xp, TorreDeVidro } = require("./db-verification.js");
const db = new DbVerification();
const xpManager = new Xp();
const torre = new TorreDeVidro();

//Importa o whatsappweb.js
const { Client, LocalAuth } = require("whatsapp-web.js");

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
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  await db.resetAllEstados();
  console.log("Bot pronto!");
});

// ========================
// FUNÇÕES AUXILIARES (DIÁRIA)
// ========================

//Constante do XP
const XP_CONSTANT = 50;

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
🏆 /ranking – Descubra quem está no topo da turma (em breve).
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
  //const NUMERO_AUTORIZADO = ;
  //if (numero !== NUMERO_AUTORIZADO) {
  //  return; // ignora qualquer mensagem de outros números
  // }

  // Ignora mensagens antigas (enquanto bot estava off)
  if (message.timestamp < startupTime) return;

  // Ignora notificações e status
  if (message.type === "e2e_notification" || message.type === "notification")
    return;
  if (message.isStatus) return;

  // Ignora mensagens de grupos
  const chat = await message.getChat();
  if (chat.isGroup) return;

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
    if (resposta.terminou) {
      await message.reply(resposta.mensagem);
      // Opcional: enviar menu novamente
      await message.reply(MENU_TEXT);
    } else {
      // Envia feedback da resposta anterior e a próxima pergunta
      await message.reply(resposta.feedback);
      await message.reply(resposta.mensagem);
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
        break;

      // Outros comandos: /ranking, /loja (futuro)
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
