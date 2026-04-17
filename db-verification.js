const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

//Base para a exponenciação do nível
const XP_CONSTANT = 50;

function obterDataDiaria() {
  // Obtém data/hora atual no fuso de Brasília (America/Sao_Paulo)
  const agora = new Date();
  const brasilia = new Date(
    agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  let dia = new Date(brasilia);
  if (brasilia.getHours() < 6) {
    dia.setDate(dia.getDate() - 1);
  }
  // Retorna no formato YYYY-MM-DD
  return dia.toISOString().split("T")[0];
}

class DbVerification {
  //Busca no Banco de Dados se esse número possui registros lá e retorna eles
  async studentVerification(whatsappNumber) {
    const numeroLimpo = whatsappNumber.split("@")[0];
    const { data, error } = await supabase
      .from("id_student")
      .select("*")
      .eq("whatsappNumber", numeroLimpo);

    console.log(data);
    console.log(error);

    return { data, error };
  }

  //Getter do Prgoresso do Estudante: XP, Níveis, Moedas
  async getStudentProgress(whatsappNumber) {
    const numeroLimpo = whatsappNumber.split("@")[0];
    const { data, error } = await supabase
      .from("id_lvlprogress")
      .select("*")
      .eq("id_aluno", numeroLimpo);

    if (error) {
      console.error("Erro ao buscar progresso:", error);
      return { data: null, error };
    }

    // Se não houver registro de progresso, você pode optar por retornar um objeto padrão
    if (!data || data.length === 0) {
      return {
        data: null,
        error: null,
        notFound: true, // flag opcional para indicar que não existe
      };
    }

    return { data, error };
  }
  //Getter do Estado do estudante no bot (Máquina de Estados)
  async getEstado(whatsappNumber) {
    const { data, error } = await supabase
      .from("estados")
      .select("estado, dados, ultima_atividade")
      .eq("whatsappNumber", whatsappNumber)
      .maybeSingle(); // ← em vez de .single()

    if (error) {
      console.error("Erro em getEstado:", error);
      return { estado: "IDLE", dados: {}, ultima_atividade: null };
    }

    if (!data) {
      // Aluno ainda não tem registro na tabela estados
      return { estado: "IDLE", dados: {}, ultima_atividade: null };
    }

    return data; // data já é o objeto com estado, dados, etc.
  }

  //Muda o Estado do Estudante no bot
  async setEstadoEstudar(whatsappNumber) {
    const numeroLimpo = whatsappNumber.split("@")[0];

    const { data, error, count } = await supabase.from("estados").upsert(
      {
        whatsappNumber: numeroLimpo,
        estado: "estudando",
        ultima_atividade: new Date().toISOString(),
      },
      { onConflict: "whatsappNumber" },
    );

    if (error) {
      console.log("Erro em setEstado: ", error);
      return;
    }

    console.log("Linhas afetadas: ", count);
    console.log("Registro Atualizado: ", data);

    return "estudando";
  }

  async updateEstado(whatsappNumber, novoEstado, novosDados = null) {
    const numeroCompleto = whatsappNumber;
    const updatePayload = {
      estado: novoEstado,
      ultima_atividade: new Date().toISOString(),
    };

    // Se novosDados for fornecido, substitui o campo dados inteiro
    if (novosDados !== null) {
      updatePayload.dados = novosDados;
    }

    const { error } = await supabase
      .from("estados")
      .update(updatePayload)
      .eq("whatsappNumber", numeroCompleto);

    if (error) {
      console.error("Erro no updateEstado:", error);
      return false;
    }
    return true;
  }
  //Reseta o Estado para o valor padrão: idle
  async resetEstado(whatsappNumber) {
    const numeroLimpo = whatsappNumber.split("@")[0];
    const { data, error } = await supabase.from("estados").upsert(
      {
        whatsappNumber: numeroLimpo,
        estado: "idle",
        ultima_atividade: new Date().toISOString,
      },
      { onConflict: "whatsappNumber" },
    );

    if (error) {
      console.log("Erro em resetEstado: ", error);
      return;
    }

    return "idle";
  }

  //Reseta o Estado de Todos os Estudantes ao Reiniciar o bot
  async resetAllEstados() {
    const { error, count } = await supabase
      .from("estados")
      .update({
        estado: "idle",
        dados: {},
        ultima_atividade: new Date().toISOString(),
      })
      .neq("estado", "idle");

    if (error) {
      console.log("Erro no resetAllEstados: ", error);
      return;
    } else {
      console.log(
        "Todos os estados resetados com sucesso! Linhas atualizadas: ",
        count,
      );
    }
  }
}

class Xp {
  async verifyXP(studentId) {
    const { data, error } = await supabase
      .from("id_lvlprogress")
      .select("xp, level")
      .eq("id_aluno", studentId)
      .maybeSingle();

    if (error) {
      console.log("Erro: ", error);
      return;
    } else if (!data) {
      return { xp: 0, level: 1 };
    } else {
      return data;
    }
  }

  async gerarPerguntaDiaria(whatsappNumber) {
    //Verificar se o aluno já respondeu hoje
    const { data: estado } = await supabase
      .from("estados")
      .select("dados")
      .eq("whatsappNumber", whatsappNumber)
      .single();

    const ultimaDiaria = estado?.dados?.ultima_diaria;
    const hoje = obterDataDiaria();

    if (ultimaDiaria === hoje) {
      return { jaRespondeuHoje: true };
    }

    //Se não respondeu, sorteia uma pergunta para o aluno.
    const { data: perguntas, error } = await supabase
      .from("perguntas")
      .select("*")
      .limit(10);

    if (error || !perguntas || !perguntas.length === 0) {
      return { error: "Nenhuma pergunta disponível para a diária." };
    }

    const perguntaSorteada =
      perguntas[Math.floor(Math.random() * perguntas.length)];

    //Armazenar a pergunta e a data no estado (para usar na resposta)
    const novosDados = {
      ...(estado?.dados || {}),
      ultima_diaria: hoje,
      diaria_atual: {
        id: perguntaSorteada.id,
        pergunta: perguntaSorteada.pergunta,
        alternativas: perguntaSorteada.alternativas,
        resposta: perguntaSorteada.resposta,
        xp_base: perguntaSorteada.xp_base,
        jeane_coins_base: perguntaSorteada.jeane_coins_base,
      },
    };

    await supabase
      .from("estados")
      .update({ dados: novosDados })
      .eq("whatsappNumber", whatsappNumber);

    return {
      jaRespondeuHoje: false,
      pergunta: perguntaSorteada.pergunta,
      alternativas: perguntaSorteada.alternativas,
    };
  }

  async adicionarRecompensa(
    whatsappNumber,
    xpBase,
    coinsBase,
    fonte = "torre",
  ) {
    console.log("=== adicionarRecompensa ===");
    console.log("Número recebido:", whatsappNumber);
    console.log("XP Base:", xpBase, "Coins Base:", coinsBase);

    // Aplica multiplicador
    let xpGanho = xpBase;
    let coinsGanhas = coinsBase;
    if (fonte === "diaria") {
      xpGanho = Math.floor(xpBase * 1.5);
      coinsGanhas = Math.floor(coinsBase * 1.5);
      console.log(
        `Bônus diário: XP ${xpBase} -> ${xpGanho}, Coins ${coinsBase} -> ${coinsGanhas}`,
      );
    }

    // 1. Buscar progresso atual
    const { data, error: selectError } = await supabase
      .from("id_lvlprogress")
      .select("xp, jeane_coins, level")
      .eq("id_aluno", whatsappNumber)
      .maybeSingle();

    if (selectError) {
      console.error("Erro no SELECT:", selectError);
      return false;
    }

    if (!data) {
      console.error(
        "Aluno não encontrado na tabela id_lvlprogress. Criando registro...",
      );
      // Cria registro inicial
      const { error: insertError } = await supabase
        .from("id_lvlprogress")
        .insert({
          id_aluno: whatsappNumber,
          xp: xpGanho,
          jeane_coins: coinsGanhas,
          level: 1,
          status: "MENU",
        });
      if (insertError) {
        console.error("Erro ao criar registro:", insertError);
        return false;
      }
      console.log("Registro criado com sucesso!");
      return true;
    }

    console.log("Progresso atual:", data);

    // Calcular novos valores
    const novoXp = (data.xp || 0) + xpGanho;
    const novasCoins = (data.jeane_coins || 0) + coinsGanhas;
    const XP_CONSTANT = 50;
    const novoLevel = Math.floor(Math.sqrt(novoXp / XP_CONSTANT)) + 1;

    console.log(
      `Novo XP: ${novoXp}, Novo Level: ${novoLevel}, Novas Coins: ${novasCoins}`,
    );

    // 2. Atualizar
    const { error: upsertError } = await supabase.from("id_lvlprogress").upsert(
      {
        id_aluno: whatsappNumber,
        xp: novoXp,
        jeane_coins: novasCoins,
        level: novoLevel,
        status: "MENU",
      },
      { onConflict: "id_aluno" },
    );

    if (upsertError) {
      console.error("Erro no UPDATE:", upsertError);
      return false;
    }

    console.log("Update realizado com sucesso!");
    return true;
  }
}

class TorreDeVidro {
  async buscarPerguntasPorDificuldade(dificuldade, quantidade = 5) {
    const { data, error } = await supabase
      .from("perguntas")
      .select("*")
      .eq("dificuldade", dificuldade)
      .limit(50); // busca um lote maior para sortear

    if (error || !data || data.length === 0) {
      return {
        error: `Nenhuma pergunta encontrada para a dificuldade ${dificuldade}.`,
      };
    }
    // Embaralhar e pegar a quantidade desejada
    const shuffled = [...data];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const perguntas = shuffled.slice(0, quantidade);
    return { perguntas };
  }

  async iniciarTorre(whatsappNumber, dificuldade) {
    const multiplicadores = {
      facil: 1.0,
      medio: 1.5,
      dificil: 2.0,
      infernal: 3.5,
      morte: 5.0,
    };
    const multiplicador = multiplicadores[dificuldade];
    if (!multiplicador) return { error: "Dificuldade inválida." };

    const { perguntas, error } = await this.buscarPerguntasPorDificuldade(
      dificuldade,
      5,
    );
    if (error) return { error };

    const dados = {
      dificuldade,
      multiplicador,
      perguntas: perguntas.map((p) => ({
        id: p.id,
        texto: p.pergunta,
        alternativas: p.alternativas,
        resposta: Number(p.resposta),
        xp_base: p.xp_base,
        coins_base: p.jeane_coins_base,
      })),
      indice: 0,
      acertos: 0,
      xp_acumulado: 0,
      coins_acumuladas: 0,
    };

    const { error: updateError } = await supabase
      .from("estados")
      .update({
        estado: "TORRE",
        dados: dados,
        ultima_atividade: new Date().toISOString(),
      })
      .eq("whatsappNumber", whatsappNumber);

    if (updateError) return { error: updateError.message };
    return { dados };
  }

  async processarRespostaTorre(whatsappNumber, respostaAluno) {
    console.log("🔍 processarRespostaTorre iniciado");
    // Buscar estado atual
    const { data: estado, error } = await supabase
      .from("estados")
      .select("dados")
      .eq("whatsappNumber", whatsappNumber)
      .single();

    //Debugging
    const dados = estado.dados;
    const perguntaAtual = dados.perguntas[dados.indice];
    console.log("Resposta do aluno (bruta):", respostaAluno);
    console.log("Índice atual:", dados.indice);
    console.log("Total de perguntas:", dados.perguntas?.length);
    if (!perguntaAtual) {
      console.log("❌ Pergunta atual não encontrada");
      return { error: "Pergunta não encontrada." };
    }
    console.log("Pergunta atual:", perguntaAtual.texto);

    //Fim do Debugging

    console.log("Estado retornado:", estado);
    if (error || !estado) {
      return { error: "Nenhum simulado ativo." };
    }

    //const dados = estado.dados;
    //const perguntaAtual = dados.perguntas[dados.indice];
    if (!perguntaAtual) return { error: "Pergunta não encontrada." };

    // Converter resposta (letra ou número) para índice
    let indiceResposta = -1;
    const resposta = respostaAluno.trim().toLowerCase();
    if (["a", "b", "c", "d"].includes(resposta)) {
      indiceResposta = resposta.charCodeAt(0) - 97;
    } else if (["1", "2", "3", "4"].includes(resposta)) {
      indiceResposta = parseInt(resposta) - 1;
    }
    if (
      indiceResposta < 0 ||
      indiceResposta >= perguntaAtual.alternativas.length
    ) {
      return { error: "Resposta inválida. Use a, b, c, d ou 1,2,3,4." };
    }

    const acertou = indiceResposta === perguntaAtual.resposta;
    let mensagem = "";

    if (acertou) {
      dados.acertos++;
      dados.xp_acumulado += perguntaAtual.xp_base;
      dados.coins_acumuladas += perguntaAtual.coins_base;
      mensagem = "✅ Correta!";
    } else {
      const letras = ["a", "b", "c", "d"];
      const letraCorreta = letras[perguntaAtual.resposta];
      const textoCorreto = perguntaAtual.alternativas[perguntaAtual.resposta];
      mensagem = `❌ Errada! A correta é ${letraCorreta}) ${textoCorreto}.`;
    }

    // Avançar índice
    dados.indice++;
    const terminou = dados.indice >= dados.perguntas.length;

    if (terminou) {
      // Calcular recompensa final com multiplicador
      const xpTotal = Math.floor(dados.xp_acumulado * dados.multiplicador);
      const coinsTotal = Math.floor(
        dados.coins_acumuladas * dados.multiplicador,
      );
      // Chamar método de adicionar recompensa (você já tem)
      const xp = new Xp();
      await xp.adicionarRecompensa(
        whatsappNumber,
        xpTotal,
        coinsTotal,
        "torre",
      );
      mensagem += `\n\n🏆 *Simulado concluído!*\nAcertos: ${dados.acertos}/${dados.perguntas.length}\nXP ganho: ${xpTotal}\nJeane Coins: ${coinsTotal}`;
      // Limpar estado (voltar para IDLE)
      await supabase
        .from("estados")
        .update({ estado: "IDLE", dados: {} })
        .eq("whatsappNumber", whatsappNumber);
      return { terminou: true, mensagem };
    } else {
      // Salvar progresso
      await supabase
        .from("estados")
        .update({ dados: dados, ultima_atividade: new Date().toISOString() })
        .eq("whatsappNumber", whatsappNumber);
      // Retornar a próxima pergunta
      const proxima = dados.perguntas[dados.indice];
      const letras = ["a", "b", "c", "d"];
      let perguntaStr = `📖 *Pergunta ${dados.indice + 1} de ${dados.perguntas.length}*\n\n${proxima.texto}\n\n`;
      proxima.alternativas.forEach((alt, idx) => {
        perguntaStr += `${letras[idx]}) ${alt}\n`;
      });
      perguntaStr += "\nResponda com a letra (a, b, c, d).";
      return { terminou: false, mensagem: perguntaStr, feedback: mensagem };
    }
  }
}

module.exports = { DbVerification, Xp, TorreDeVidro };
