const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const TEMPO_POR_DIFICULDADE = {
  facil: 30,
  medio: 45,
  dificil: 60,
  infernal: 90,
  morte: 120,
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

async function possuiHabilidade(whatsappNumber, nomeHabilidade) {
  // 1. Buscar id do item na loja
  const { data: item } = await supabase
    .from("loja_itens")
    .select("id")
    .eq("nome", nomeHabilidade)
    .single();
  if (!item) return false;
  // 2. Verificar se aluno tem no inventário
  const { data: inv } = await supabase
    .from("inventario_aluno")
    .select("id")
    .eq("whatsappNumber", whatsappNumber)
    .eq("item_id", item.id)
    .maybeSingle();
  console.log(
    `Verificando habilidade ${nomeHabilidade} para ${whatsappNumber}`,
  );
  return !!inv;
}

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

  async obterRanking() {
    try {
      // Mapear todos os títulos da loja (id -> nome com ícone)
      const { data: itensTitulo, error: errItens } = await supabase
        .from("loja_itens")
        .select("id, nome, icone")
        .eq("categoria", "titulo");
      if (errItens) throw errItens;
      const titulosMap = new Map();
      itensTitulo.forEach((t) => {
        titulosMap.set(t.id, `${t.icone || "🏷️"} ${t.nome}`);
      });

      // Buscar alunos, incluindo perfil_config (para saber título equipado)
      const { data: alunos, error: errAlunos } = await supabase
        .from("id_student")
        .select("username, whatsappNumber, avatar, perfil_config");
      if (errAlunos) throw errAlunos;

      // Buscar níveis (levelMap)
      const { data: niveis, error: errNiveis } = await supabase
        .from("id_lvlprogress")
        .select("id_aluno, level");
      if (errNiveis) throw errNiveis;
      const levelMap = new Map();
      niveis.forEach((n) => levelMap.set(n.id_aluno, n.level || 1));

      // Buscar estatísticas de acertos (statsMap)
      const { data: stats, error: errStats } = await supabase
        .from("estatisticas_aluno")
        .select("*");
      if (errStats) throw errStats;
      const statsMap = new Map();
      stats.forEach((s) => statsMap.set(s.whatsappNumber, s));

      const pesos = { facil: 1, medio: 2, dificil: 3, infernal: 5, morte: 8 };
      const ranking = [];

      for (const aluno of alunos) {
        if (!aluno.whatsappNumber) continue;
        const level = levelMap.get(aluno.whatsappNumber) || 1;
        const acertos = statsMap.get(aluno.whatsappNumber) || {};
        const acertosPonderados =
          (acertos.total_acertos_facil || 0) * pesos.facil +
          (acertos.total_acertos_medio || 0) * pesos.medio +
          (acertos.total_acertos_dificil || 0) * pesos.dificil +
          (acertos.total_acertos_infernal || 0) * pesos.infernal +
          (acertos.total_acertos_morte || 0) * pesos.morte;
        const pontuacao = level * 100 + acertosPonderados;

        // Título equipado
        let tituloEquipado = null;
        const tituloId = aluno.perfil_config?.titulo_equipado_id;
        if (tituloId && titulosMap.has(tituloId)) {
          tituloEquipado = titulosMap.get(tituloId);
        }

        ranking.push({
          username: aluno.username,
          level: level,
          pontuacao: pontuacao,
          whatsappNumber: aluno.whatsappNumber,
          avatar: aluno.avatar,
          tituloEquipado: tituloEquipado,
        });
      }

      ranking.sort((a, b) => b.pontuacao - a.pontuacao);
      return ranking;
    } catch (error) {
      console.error("Erro em obterRanking:", error);
      return [];
    }
  }

  async obterPerfil(whatsappNumber) {
    // Buscar aluno
    const { data: aluno, error: errAluno } = await supabase
      .from("id_student")
      .select("username, avatar")
      .eq("whatsappNumber", whatsappNumber)
      .maybeSingle(); // ← mude de .single() para .maybeSingle()

    if (errAluno || !aluno) {
      console.error("Aluno não encontrado:", errAluno);
      return null; // ou retorne um objeto padrão
    }

    // Buscar progresso (também use maybeSingle)
    const { data: progresso, error: errProgress } = await supabase
      .from("id_lvlprogress")
      .select("level, jeane_coins, torre_nivel_max")
      .eq("id_aluno", whatsappNumber)
      .maybeSingle();

    // Buscar estatísticas (maybeSingle)
    const { data: stats, error: errStats } = await supabase
      .from("estatisticas_aluno")
      .select(
        "total_acertos_facil, total_acertos_medio, total_acertos_dificil, total_acertos_infernal, total_acertos_morte",
      )
      .eq("whatsappNumber", whatsappNumber)
      .maybeSingle();

    const totalAcertos =
      (stats?.total_acertos_facil || 0) +
      (stats?.total_acertos_medio || 0) +
      (stats?.total_acertos_dificil || 0) +
      (stats?.total_acertos_infernal || 0) +
      (stats?.total_acertos_morte || 0);

    return {
      username: aluno.username,
      avatar: aluno.avatar,
      level: progresso?.level || 1,
      jeane_coins: progresso?.jeane_coins || 0,
      torre_nivel_max: progresso?.torre_nivel_max || "Fácil",
      total_acertos: totalAcertos,
    };
  }

  async getPerfilConfig(whatsappNumber) {
    const { data, error } = await supabase
      .from("id_student")
      .select("perfil_config")
      .eq("whatsappNumber", whatsappNumber)
      .maybeSingle();
    if (error) return {};
    return data?.perfil_config || {};
  }

  async listarItensLoja(categoria = null) {
    let query = supabase.from("loja_itens").select("*").eq("disponivel", true);
    if (categoria) query = query.eq("categoria", categoria);
    const { data, error } = await query;
    if (error) return [];
    return data;
  }

  async comprarItem(whatsappNumber, itemId) {
    // 1. Buscar item
    const { data: item, error: itemErr } = await supabase
      .from("loja_itens")
      .select("custo")
      .eq("id", itemId)
      .maybeSingle();
    if (itemErr) return { error: "Item não encontrado" };

    // 2. Buscar Jeane Coins do aluno
    const { data: aluno, error: coinErr } = await supabase
      .from("id_lvlprogress")
      .select("jeane_coins")
      .eq("id_aluno", whatsappNumber)
      .maybeSingle();
    if (coinErr || aluno.jeane_coins < item.custo) {
      return { error: "Moedas insuficientes" };
    }

    // 3. Deduzir moedas e adicionar ao inventário
    const { error: updateErr } = await supabase
      .from("id_lvlprogress")
      .update({ jeane_coins: aluno.jeane_coins - item.custo })
      .eq("id_aluno", whatsappNumber);
    if (updateErr) return { error: "Erro na compra" };

    const { error: insertErr } = await supabase
      .from("inventario_aluno")
      .insert({ whatsappNumber, item_id: itemId });
    if (insertErr) return { error: "Erro ao registrar item" };
    return { success: true };
  }

  async getInventario(whatsappNumber) {
    const { data, error } = await supabase
      .from("inventario_aluno")
      .select("item_id, equipado")
      .eq("whatsappNumber", whatsappNumber);
    if (error) return [];
    return data;
  }

  async equiparItem(whatsappNumber, itemId, categoria) {
    // Verifica se o aluno possui o item
    const { data: possui, error: possuiErr } = await supabase
      .from("inventario_aluno")
      .select("id")
      .eq("whatsappNumber", whatsappNumber)
      .eq("item_id", itemId)
      .maybeSingle();
    if (possuiErr) return { error: "Item não encontrado no inventário" };

    // Atualiza perfil_config (substitui a categoria pela nova)
    const { data: aluno } = await supabase
      .from("id_student")
      .select("perfil_config")
      .eq("whatsappNumber", whatsappNumber)
      .maybeSingle();
    const config = aluno.perfil_config || {};
    config[categoria] = itemId;

    const { error: updateErr } = await supabase
      .from("id_student")
      .update({ perfil_config: config })
      .eq("whatsappNumber", whatsappNumber);
    if (updateErr) return { error: "Erro ao equipar" };

    return { success: true };
  }
  async atualizarEstatisticasTopico(alunoId, topico, acertou) {
    const { error } = await supabase.rpc("atualizar_estatisticas_topico", {
      p_aluno_id: alunoId,
      p_topico: topico,
      p_acertou: acertou,
    });
    if (error)
      console.error("Erro ao atualizar estatísticas de tópico:", error);
  }

  async getEstatisticas(whatsappNumber) {
    // Se você já tem a tabela `estatisticas_topicos` (criada anteriormente)
    const { data, error } = await supabase
      .from("estatisticas_topicos")
      .select("topico, acertos, tentativas")
      .eq("whatsappNumber", whatsappNumber); // ou student_id
    if (error) {
      console.error(error);
      return null;
    }
    return data; // array de { topico, acertos, tentativas }
  }

  async obterTopicosPrioritarios(studentId) {
    const { data, error } = await supabase
      .from("estatisticas_topicos")
      .select("topico, acertos, tentativas")
      .eq("aluno_id", studentId)
      .filter("tentativas", "gt", 3); // pelo menos 3 tentativas
    if (error) return [];
    const topicos = data.map((t) => ({
      topico: t.topico,
      percentual: (t.acertos / t.tentativas) * 100,
    }));
    topicos.sort((a, b) => a.percentual - b.percentual);
    return topicos.slice(0, 5); // 5 piores
  }
  async listarItensPaginados(categoria, pagina, itensPorPagina = 10) {
    const offset = (pagina - 1) * itensPorPagina;
    const { data, error, count } = await supabase
      .from("loja_itens")
      .select("*", { count: "exact" })
      .eq("categoria", categoria)
      .eq("disponivel", true)
      .range(offset, offset + itensPorPagina - 1);
    if (error) return { itens: [], total: 0 };
    return { itens: data, total: count };
  }
  async listarItensLojaPaginados(categoria, pagina, itensPorPagina = 10) {
    const offset = (pagina - 1) * itensPorPagina;
    const { data, error, count } = await supabase
      .from("loja_itens")
      .select("*", { count: "exact" })
      .eq("categoria", categoria)
      .eq("disponivel", true)
      .order("custo", { ascending: true })
      .range(offset, offset + itensPorPagina - 1);
    if (error) return { itens: [], total: 0 };
    return { itens: data, total: count };
  }
  async listarItensPorCategoria(categoria) {
    const { data, error } = await supabase
      .from("loja_itens")
      .select("*")
      .eq("categoria", categoria)
      .eq("disponivel", true);
    if (error) return [];
    return data;
  }
  async listarItensConsumiveis() {
    // Buffs temporários (consumíveis com 'tipo' no campo dados)
    const { data, error } = await supabase
      .from("loja_itens")
      .select("*")
      .eq("categoria", "consumivel")
      .eq("disponivel", true);
    if (error) return [];
    return data;
  }
}

class Xp {
  async getBuffAtivo(whatsappNumber, tipo) {
    // tipo pode ser 'xp', 'coins', 'xp_coins'
    const { data, error } = await supabase
      .from("buffs_ativos")
      .select("multiplicador, expira_em")
      .eq("whatsappNumber", whatsappNumber)
      .eq("tipo", tipo)
      .gt("expira_em", new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;
    return data.multiplicador;
  }
  async verifyXP(studentId) {
    const { data, error } = await supabase
      .from("id_lvlprogress")
      .select("xp, level")
      .eq("id_aluno", studentId)
      .maybemaybeSingle();

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
      .maybeSingle();

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
        topico: perguntaSorteada.topico, // ← ESSENCIAL
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

    // 1. Aplicar bônus da diária PRIMEIRO (sobre o valor base)
    let xpAposBonus = xpBase;
    let coinsAposBonus = coinsBase;
    if (fonte === "diaria") {
      xpAposBonus = Math.floor(xpBase * 1.5);
      coinsAposBonus = Math.floor(coinsBase * 1.5);
      console.log(
        `Bônus diário: XP ${xpBase} -> ${xpAposBonus}, Coins ${coinsBase} -> ${coinsAposBonus}`,
      );
    }

    // 2. Buscar buffs ativos
    let multXP = await xpInstance.getBuffAtivo(whatsappNumber, "xp");
    let multCoins = await xpInstance.getBuffAtivo(whatsappNumber, "coins");
    const buffCombinado = await xpInstance.getBuffAtivo(
      whatsappNumber,
      "xp_coins",
    );

    if (buffCombinado) {
      multXP = buffCombinado;
      multCoins = buffCombinado;
    }

    multXP = multXP || 1;
    multCoins = multCoins || 1;

    console.log(`Multiplicadores: XP x${multXP}, Coins x${multCoins}`);

    // 3. Aplicar multiplicadores dos buffs
    let xpGanho = Math.floor(xpAposBonus * multXP);
    let coinsGanhas = Math.floor(coinsAposBonus * multCoins);

    console.log(`Recompensa final: +${xpGanho} XP, +${coinsGanhas} Coins`);

    // 4. Buscar progresso atual (mesmo código de antes)
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
      console.error("Aluno não encontrado. Criando registro...");
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

    // Atualizar banco
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
      console.error("Erro no UPSERT:", upsertError);
      return false;
    }

    console.log("Update realizado com sucesso!");
    return true;
  }
}

function montarPerguntaString(pergunta, andarNum, perguntaNum) {
  let txt = `🏰 *Andar ${andarNum}* - Pergunta ${perguntaNum}\n\n`;
  if (pergunta.imagem_url) {
    txt += `🖼️ Imagem: ${pergunta.imagem_url}\n\n`; // Na prática você pode enviar a imagem separadamente
  }
  txt += `${pergunta.pergunta}\n\n`;
  if (pergunta.alternativas && pergunta.alternativas.length) {
    const letras = ["a", "b", "c", "d"];
    pergunta.alternativas.forEach((alt, idx) => {
      txt += `${letras[idx]}) ${alt}\n`;
    });
    txt += `\nResponda com a letra (a, b, c, d).`;
  } else {
    txt += `\nResponda com sua resposta (texto livre).`;
  }
  return txt;
}

const xpInstance = new Xp(); // instância única

class TorreDeVidro {
  async buscarPerguntasPorDificuldade(
    dificuldade,
    quantidade,
    whatsappNumber,
    diasExclusao = 30,
  ) {
    // 1. Calcular data limite
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasExclusao);
    const dataStr = dataLimite.toISOString().split("T")[0];

    // 2. Obter IDs das perguntas respondidas recentemente
    let excludeIds = [];
    const { data: historico, error: histError } = await supabase
      .from("historico_perguntas_aluno")
      .select("pergunta_id")
      .eq("whatsappNumber", whatsappNumber)
      .gte("data_resposta", dataStr);
    if (!histError && historico) {
      excludeIds = historico.map((h) => h.pergunta_id);
    } else {
      console.error("Erro ao buscar histórico (ignorado):", histError);
    }

    // 3. Consultar perguntas da dificuldade, excluindo IDs do histórico
    let query = supabase
      .from("perguntas")
      .select("*")
      .eq("dificuldade", dificuldade)
      .limit(50);
    if (excludeIds.length > 0) {
      // Convert array to string format "(1,2,3)"
      const idsStr = excludeIds.join(",");
      query = query.not("id", "in", `(${idsStr})`);
    }
    const { data, error } = await query;
    if (error) {
      console.error("Erro ao buscar perguntas:", error);
      return [];
    }

    // 4. Embaralhar
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [data[i], data[j]] = [data[j], data[i]];
    }

    let perguntas = data.slice(0, quantidade);

    // 5. Fallback: se não houver perguntas suficientes, buscar sem filtro de exclusão
    if (perguntas.length < quantidade) {
      const falta = quantidade - perguntas.length;
      const { data: fallback, error: fallbackError } = await supabase
        .from("perguntas")
        .select("*")
        .eq("dificuldade", dificuldade)
        .limit(falta);
      if (!fallbackError && fallback && fallback.length) {
        perguntas.push(...fallback);
      } else {
        console.warn("Fallback também não encontrou perguntas suficientes.");
      }
    }

    return perguntas;
  }

  async registrarHistoricoPergunta(whatsappNumber, perguntaId) {
    const hoje = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("historico_perguntas_aluno")
      .upsert(
        { whatsappNumber, pergunta_id: perguntaId, data_resposta: hoje },
        { onConflict: "whatsappNumber, pergunta_id, data_resposta" },
      );
    if (error) console.error("Erro ao registrar histórico:", error);
  }

  shuffleAlternatives(alternativas, respostaOriginal) {
    const respostaNum = Number(respostaOriginal); // força conversão para número
    const indices = [0, 1, 2, 3];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const novasAlternativas = indices.map((i) => alternativas[i]);
    const novaResposta = indices.indexOf(respostaNum);
    if (novaResposta === -1) {
      console.error(
        "Erro: resposta original não encontrada no embaralhamento",
        respostaNum,
      );
      return { alternativas, resposta: respostaNum };
    }
    return { alternativas: novasAlternativas, resposta: novaResposta };
  }

  async iniciarTorre(whatsappNumber, dificuldade) {
    // dificuldade não será usada diretamente, mas mantida para compatibilidade
    const qtdPerguntasPorAndar = 5;
    const dificuldadesPorAndar = [
      "facil",
      "medio",
      "dificil",
      "infernal",
      "morte",
    ]; // 5 andares

    const andares = [];
    for (let i = 0; i < dificuldadesPorAndar.length; i++) {
      const perguntas = await this.buscarPerguntasPorDificuldade(
        dificuldadesPorAndar[i],
        qtdPerguntasPorAndar,
        whatsappNumber,
        30,
      );
      if (!perguntas || perguntas.length < qtdPerguntasPorAndar) {
        return {
          error: `Não há perguntas suficientes para o andar ${i + 1} (${dificuldadesPorAndar[i]})`,
        };
      }
      // Embaralhar alternativas de cada pergunta
      const andarProcessado = perguntas.map((p) => {
        const { alternativas, resposta } = this.shuffleAlternatives(
          p.alternativas,
          p.resposta,
        );
        return {
          ...p,
          alternativas,
          resposta,
        };
      });
      andares.push(andarProcessado);
    }

    const dados = {
      andarAtual: 0,
      indicePergunta: 0,
      vidas: 3,
      streak: 0,
      xpAcumulado: 0,
      coinsAcumuladas: 0,
      andares: andares,
      timestampPergunta: null,
      escudoUsado: false,
      pularUsado: false,
    };

    const { error } = await supabase
      .from("estados")
      .update({
        estado: "TORRE",
        dados: dados,
        ultima_atividade: new Date().toISOString(),
      })
      .eq("whatsappNumber", whatsappNumber);
    if (error) return { error: error.message };
    return { dados };
  }

  async processarRespostaTorre(whatsappNumber, respostaAluno, openaiClient) {
    // 1. Buscar estado
    const { data: estado, error } = await supabase
      .from("estados")
      .select("estado, dados, ultima_atividade")
      .eq("whatsappNumber", whatsappNumber)
      .maybeSingle();
    if (error || !estado || estado.estado !== "TORRE")
      return { error: "Nenhum simulado ativo." };

    let dados = estado.dados;
    const andarAtual = dados.andares[dados.andarAtual];
    dados.timestampPergunta = new Date().toISOString(); // <-- RESETAR TIMESTAMP

    const perguntaAtual = andarAtual[dados.indicePergunta];

    if (!perguntaAtual) return { error: "Pergunta não encontrada." };

    // 2. Verificar timeout (baseado no timestampPergunta salvo)
    const agora = new Date();
    const tempoDecorrido = (agora - new Date(dados.timestampPergunta)) / 1000;
    await supabase
      .from("estados")
      .update({ dados, ultima_atividade: agora.toISOString() })
      .eq("whatsappNumber", whatsappNumber);
    const tempos = {
      facil: 40,
      medio: 60,
      dificil: 90,
      infernal: 120,
      morte: 150,
    };
    const tempoLimite = tempos[perguntaAtual.dificuldade] || 60;
    if (tempoDecorrido > tempoLimite) {
      dados.vidas--;
      dados.streak = 0;
      if (dados.vidas <= 0) {
        if (dados.vidas <= 0) {
          // Recompensa parcial baseada no andar completado
          const andaresCompletos = dados.andarAtual; // andar atual já é o próximo? Cuidado.
          // Supondo que dados.andarAtual é o índice do andar que está sendo jogado (0-based).
          // Se ele morreu no meio do andar, talvez queira dar apenas metade.
          let multiplicadorRecompensa = 0.5; // 50% do acumulado
          if (andaresCompletos > 0) {
            // Pode dar bônus fixo por andar completado, etc.
            multiplicadorRecompensa = 0.5 + andaresCompletos * 0.1;
            multiplicadorRecompensa = Math.min(multiplicadorRecompensa, 1.0); // limite
          }
          const xpFinal = Math.floor(
            dados.xpAcumulado * multiplicadorRecompensa,
          );
          const coinsFinal = Math.floor(
            dados.coinsAcumuladas * multiplicadorRecompensa,
          );
          await xpInstance.adicionarRecompensa(
            whatsappNumber,
            xpFinal,
            coinsFinal,
            "torre",
          );
          await supabase
            .from("estados")
            .update({ estado: "IDLE", dados: {} })
            .eq("whatsappNumber", whatsappNumber);
          return {
            terminou: true,
            mensagem: `💀 Você ficou sem vidas! Fim do simulado.\nVocê ganhou ${xpFinal} XP e ${coinsFinal} JC baseado no seu desempenho.`,
          };
        }
      }
      // Avança para próxima pergunta
      dados.indicePergunta++;
      if (dados.indicePergunta >= andarAtual.length) {
        dados.indicePergunta = 0;
        dados.andarAtual++;
      }
      await supabase
        .from("estados")
        .update({ dados, ultima_atividade: agora.toISOString() })
        .eq("whatsappNumber", whatsappNumber);
      const proxima = dados.andares[dados.andarAtual][dados.indicePergunta];
      const perguntaStr = montarPerguntaString(
        proxima,
        dados.andarAtual + 1,
        dados.indicePergunta + 1,
      );
      const hearts = "❤️".repeat(dados.vidas);
      return {
        terminou: false,
        mensagem: perguntaStr,
        feedback: `⏰ Tempo esgotado! Você perdeu uma vida. ${hearts}`,
      };
    }

    // 3. Processar resposta (normal ou aberta)
    const isRespostaAberta =
      perguntaAtual.dificuldade === "infernal" ||
      perguntaAtual.dificuldade === "morte";
    let acertou = false;

    if (isRespostaAberta) {
      const avaliacao = await this.avaliarRespostaAberta(
        perguntaAtual.pergunta,
        respostaAluno,
        perguntaAtual.resposta,
        openaiClient,
      );
      acertou = avaliacao.acertou;
    } else {
      const respostaNorm = respostaAluno.trim().toLowerCase();
      let indiceResposta = -1;
      if (["a", "b", "c", "d"].includes(respostaNorm)) {
        indiceResposta = respostaNorm.charCodeAt(0) - 97;
      } else if (["1", "2", "3", "4"].includes(respostaNorm)) {
        indiceResposta = parseInt(respostaNorm) - 1;
      }
      // Garantir que perguntaAtual.resposta seja número
      const respCorreta = Number(perguntaAtual.resposta);
      acertou = indiceResposta === respCorreta;

      console.log("Alternativas atuais:", perguntaAtual.alternativas);
      console.log("Resposta esperada (índice):", perguntaAtual.resposta);
      console.log(
        "Resposta esperada (texto):",
        perguntaAtual.alternativas[perguntaAtual.resposta],
      );
      console.log("Índice do aluno:", indiceResposta);
    }

    let mensagemFeedback = "";
    if (acertou) {
      dados.streak++;
      const multiplicador = Math.min(
        1 + Math.floor(dados.streak / 5) * 0.1,
        2.0,
      );
      let xpGanho = Math.floor(perguntaAtual.xp_base * multiplicador);
      let coinsGanho = Math.floor(
        perguntaAtual.jeane_coins_base * multiplicador,
      );

      // Buscar buffs ativos (reaproveite a função getBuffAtivo)
      let multXP = 1;
      let multCoins = 1;
      const buffXP = await xpInstance.getBuffAtivo(whatsappNumber, "xp"); // se existir
      const buffCoins = await xpInstance.getBuffAtivo(whatsappNumber, "coins");
      const buffCombo = await xpInstance.getBuffAtivo(
        whatsappNumber,
        "xp_coins",
      );
      if (buffCombo) {
        multXP = buffCombo;
        multCoins = buffCombo;
      } else {
        // Dentro do else (quando erra)
        if (buffXP) multXP = buffXP;
        if (buffCoins) multCoins = buffCoins;
      }

      // Aplica os buffs ao valor base da pergunta
      xpGanho = Math.floor(perguntaAtual.xp_base * multXP);
      coinsGanho = Math.floor(perguntaAtual.jeane_coins_base * multCoins);

      // Depois, multiplicador de streak (se existir) – já está feito
      const multiplicadorStreak = Math.min(
        1 + Math.floor(dados.streak / 5) * 0.1,
        2.0,
      );
      xpGanho = Math.floor(xpGanho * multiplicadorStreak);
      coinsGanho = Math.floor(coinsGanho * multiplicadorStreak);

      // Agora acumula
      dados.xpAcumulado += xpGanho;
      dados.coinsAcumuladas += coinsGanho;

      mensagemFeedback = `✅ Correta! (+${xpGanho} XP, +${coinsGanho} JC)`;
      if (dados.streak >= 5)
        mensagemFeedback += ` 🔥 Streak ${dados.streak}! (multiplicador ${multiplicador}x)`;
      await this.registrarHistoricoPergunta(whatsappNumber, perguntaAtual.id);
      dados.indicePergunta++;
    } else {
      let perdeVida = true;
      console.log("Verificando Escudo do Erro...");

      const temEscudo = await possuiHabilidade(
        whatsappNumber,
        "Escudo do Erro",
      );
      console.log("Tem escudo?", temEscudo);
      console.log("Escudo usado agora?", dados.escudoUsado)

      if (temEscudo && !dados.escudoUsado) {
        dados.escudoUsado = true; // marca como usado neste simulado
        perdeVida = false;
        mensagemFeedback = "🛡️ *Escudo do Erro ativado!* Você não perdeu vida.";
      }
      if (perdeVida) {
        dados.vidas--;
        const hearts = "❤️".repeat(dados.vidas) + "🖤".repeat(3 - dados.vidas);
        mensagemFeedback = `❌ Errada! ${hearts}`;
      }
      dados.indicePergunta++;

      if (dados.vidas <= 0) {
        if (dados.vidas <= 0) {
          // Recompensa parcial baseada no andar completado
          const andaresCompletos = dados.andarAtual; // andar atual já é o próximo? Cuidado.
          // Supondo que dados.andarAtual é o índice do andar que está sendo jogado (0-based).
          // Se ele morreu no meio do andar, talvez queira dar apenas metade.
          let multiplicadorRecompensa = 0.5; // 50% do acumulado
          if (andaresCompletos > 0) {
            // Pode dar bônus fixo por andar completado, etc.
            multiplicadorRecompensa = 0.5 + andaresCompletos * 0.1;
            multiplicadorRecompensa = Math.min(multiplicadorRecompensa, 1.0); // limite
          }
          const xpFinal = Math.floor(
            dados.xpAcumulado * multiplicadorRecompensa,
          );
          const coinsFinal = Math.floor(
            dados.coinsAcumuladas * multiplicadorRecompensa,
          );
          await xpInstance.adicionarRecompensa(
            whatsappNumber,
            xpFinal,
            coinsFinal,
            "torre",
          );
          await supabase
            .from("estados")
            .update({ estado: "IDLE", dados: {} })
            .eq("whatsappNumber", whatsappNumber);
          return {
            terminou: true,
            mensagem: `💀 Você ficou sem vidas! Fim do simulado.\nVocê ganhou ${xpFinal} XP e ${coinsFinal} JC baseado no seu desempenho.`,
          };
        }
      }
      const vidasTotais = 3;
      const coracoesRestantes = "❤️".repeat(dados.vidas);
      const coracoesPerdidos = "🖤".repeat(vidasTotais - dados.vidas);
    }

    // Verificar se completou o andar
    let andarCompleto = false;
    if (dados.indicePergunta >= andarAtual.length) {
      dados.indicePergunta = 0;
      dados.andarAtual++;
      andarCompleto = true;
      dados.xpAcumulado += 20;
      dados.coinsAcumuladas += 10;
      mensagemFeedback += `\n🎉 Andar ${dados.andarAtual} completo! +20 XP, +10 JC.`;
    }

    // Verificar se terminou todos os andares
    if (dados.andarAtual >= dados.andares.length) {
      const bonusVidas = dados.vidas * 30;
      const xpTotal = dados.xpAcumulado + bonusVidas;
      const coinsTotal = dados.coinsAcumuladas + bonusVidas;
      await xpInstance.adicionarRecompensa(
        whatsappNumber,
        xpTotal,
        coinsTotal,
        "torre",
      );
      await supabase
        .from("estados")
        .update({ estado: "IDLE", dados: {} })
        .eq("whatsappNumber", whatsappNumber);
      return {
        terminou: true,
        mensagem: `🏆 Simulado concluído! Você terminou com ${dados.vidas} vida(s) restantes.\nXP total: ${xpTotal}\nJC: ${coinsTotal}`,
      };
    }

    // Salvar estado (próxima pergunta)
    await supabase
      .from("estados")
      .update({ dados, ultima_atividade: agora.toISOString() })
      .eq("whatsappNumber", whatsappNumber);

    // Montar próxima pergunta
    const proximaPergunta =
      dados.andares[dados.andarAtual][dados.indicePergunta];
    const perguntaStr = montarPerguntaString(
      proximaPergunta,
      dados.andarAtual + 1,
      dados.indicePergunta + 1,
    );
    return {
      terminou: false,
      mensagem: perguntaStr,
      feedback: mensagemFeedback,
    };
  }

  async avaliarRespostaAberta(
    pergunta,
    respostaAluno,
    respostaEsperada,
    openaiClient,
  ) {
    const prompt = `Você é um corretor de questões de português. Avalie se a resposta do aluno está correta para a pergunta abaixo. Considere a resposta esperada como referência, mas aceite variações plausíveis. Responda apenas "true" ou "false".

Pergunta: ${pergunta}
Resposta do aluno: ${respostaAluno}
Resposta esperada: ${respostaEsperada}`;
    try {
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 10,
        temperature: 0,
      });
      const resultado = completion.choices[0].message.content
        .trim()
        .toLowerCase();
      return { acertou: resultado === "true" };
    } catch (err) {
      console.error("Erro na avaliação da resposta aberta:", err);
      return { acertou: false };
    }
  }
}

module.exports = {
  DbVerification,
  Xp,
  TorreDeVidro,
  montarPerguntaString,
  possuiHabilidade,
};
