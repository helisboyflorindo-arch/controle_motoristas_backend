const express = require('express');
const pool = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();


// ======================================================
// DASHBOARD DO ADMINISTRADOR - V2
// ======================================================

router.get('/', autenticar, somenteAdmin, async (req, res) => {
  try {
    const data = req.query.data;

    if (!data) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Informe a data. Exemplo: ?data=2026-08-17'
      });
    }

    // ==================================================
    // 1. TOTAL DE MOTORISTAS
    // ==================================================

    const [[motoristasTotais]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM motoristas
    `);

    // ==================================================
    // 2. MOTORISTAS ATIVOS
    // ==================================================

    const [[motoristasAtivos]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM motoristas
      WHERE ativo = 1
    `);

    // ==================================================
    // 3. TOTAL ARRECADADO DO DIA
    // ==================================================

    const [[arrecadacao]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_corridas,
        COALESCE(SUM(valor_total), 0) AS receita
      FROM corridas
      WHERE DATE(data_corrida) = ?
      `,
      [data]
    );

    // ==================================================
    // 4. TOTAL DE DESPESAS DO DIA
    // ==================================================

    const [[despesas]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_despesas,
        COALESCE(SUM(valor), 0) AS despesas
      FROM despesas
      WHERE DATE(data) = ?
      `,
      [data]
    );

    const totalCorridas = Number(arrecadacao.total_corridas || 0);
    const receitaTotal = Number(arrecadacao.receita || 0);

    const totalDespesasRegistros =
      Number(despesas.total_despesas || 0);

    const despesasTotal =
      Number(despesas.despesas || 0);

    // ==================================================
    // 5. SALDO GERAL
    // ==================================================

    const saldoGeral = receitaTotal - despesasTotal;

    // ==================================================
    // 6. LISTA DE MOTORISTAS ATIVOS
    // ==================================================

    const [motoristas] = await pool.query(`
      SELECT
        id,
        nome,
        telefone,
        documento,
        email,
        ativo
      FROM motoristas
      WHERE ativo = 1
      ORDER BY nome ASC
    `);

    const dadosMotoristas = [];

    for (const motorista of motoristas) {

      // ----------------------------------------------
      // CORRIDAS DO MOTORISTA
      // ----------------------------------------------

      const [[corridasMotorista]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total_corridas,
          COALESCE(SUM(valor_total), 0) AS receita
        FROM corridas
        WHERE motorista_id = ?
          AND DATE(data_corrida) = ?
        `,
        [motorista.id, data]
      );

      // ----------------------------------------------
      // DESPESAS DO MOTORISTA
      // ----------------------------------------------

      const [[despesasMotorista]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total_despesas,
          COALESCE(SUM(valor), 0) AS despesas
        FROM despesas
        WHERE motorista_id = ?
          AND DATE(data) = ?
        `,
        [motorista.id, data]
      );

      const totalCorridasMotorista =
        Number(corridasMotorista.total_corridas || 0);

      const receitaMotorista =
        Number(corridasMotorista.receita || 0);

      const despesasMotoristaTotal =
        Number(despesasMotorista.despesas || 0);

      const saldoMotorista =
        receitaMotorista - despesasMotoristaTotal;

      dadosMotoristas.push({
        id: motorista.id,
        nome: motorista.nome,
        telefone: motorista.telefone,
        documento: motorista.documento,
        email: motorista.email,
        ativo: motorista.ativo,

        total_corridas: totalCorridasMotorista,

        receita: receitaMotorista.toFixed(2),

        despesas: despesasMotoristaTotal.toFixed(2),

        saldo: saldoMotorista.toFixed(2)
      });
    }

    // ==================================================
    // 7. RESPOSTA
    // ==================================================

    return res.json({
      sucesso: true,

      data,

      totais: {
        motoristas: Number(motoristasTotais.total || 0),

        motoristas_ativos:
          Number(motoristasAtivos.total || 0),

        corridas:
          totalCorridas,

        corridas_hoje:
          totalCorridas,

        receita:
          receitaTotal.toFixed(2),

        total_arrecadado:
          receitaTotal.toFixed(2),

        despesas:
          despesasTotal.toFixed(2),

        despesas_hoje:
          despesasTotal.toFixed(2),

        total_despesas_registros:
          totalDespesasRegistros,

        saldo:
          saldoGeral.toFixed(2),

        saldo_geral:
          saldoGeral.toFixed(2)
      },

      motoristas: dadosMotoristas
    });

  } catch (error) {

    console.error(
      'ERRO AO CARREGAR DASHBOARD:',
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao carregar dashboard.',
      erro: error.message
    });
  }
});


module.exports = router;