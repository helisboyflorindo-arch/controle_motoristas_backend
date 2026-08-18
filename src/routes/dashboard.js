const express = require('express');
const pool = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();

/*
========================================================
RELATÓRIO
========================================================

Tipos aceites:

diario
semanal
mensal
anual

Exemplos:

/api/dashboard?tipo=diario&data=2026-08-18

/api/dashboard?tipo=semanal&data=2026-08-18

/api/dashboard?tipo=mensal&data=2026-08-18

/api/dashboard?tipo=anual&data=2026-08-18

Filtrar motorista:

/api/dashboard?tipo=mensal&data=2026-08-18&motorista_id=5
*/

router.get('/', autenticar, somenteAdmin, async (req, res) => {
  try {
    const {
      tipo = 'diario',
      data,
      motorista_id
    } = req.query;

    if (!data) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Informe a data.'
      });
    }

    const tiposValidos = [
      'diario',
      'semanal',
      'mensal',
      'anual'
    ];

    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          'Tipo inválido. Use diario, semanal, mensal ou anual.'
      });
    }

    /*
    ======================================================
    1. DEFINIR PERÍODO
    ======================================================
    */

    let dataInicio;
    let dataFim;

    if (tipo === 'diario') {

      dataInicio = data;
      dataFim = data;

    } else if (tipo === 'semanal') {

      const [ano, mes, dia] = data.split('-').map(Number);

      const selecionada = new Date(
        ano,
        mes - 1,
        dia
      );

      const diaSemana = selecionada.getDay();

      // Segunda-feira = início da semana
      const diferenca = diaSemana === 0
        ? -6
        : 1 - diaSemana;

      const inicio = new Date(selecionada);

      inicio.setDate(
        selecionada.getDate() + diferenca
      );

      const fim = new Date(inicio);

      fim.setDate(
        inicio.getDate() + 6
      );

      dataInicio = formatarData(inicio);
      dataFim = formatarData(fim);

    } else if (tipo === 'mensal') {

      const [ano, mes] = data
        .split('-')
        .map(Number);

      const inicio = new Date(
        ano,
        mes - 1,
        1
      );

      const fim = new Date(
        ano,
        mes,
        0
      );

      dataInicio = formatarData(inicio);
      dataFim = formatarData(fim);

    } else if (tipo === 'anual') {

      const ano = Number(
        data.split('-')[0]
      );

      dataInicio = `${ano}-01-01`;
      dataFim = `${ano}-12-31`;
    }

    /*
    ======================================================
    2. FILTRO DO MOTORISTA
    ======================================================
    */

    let filtroMotoristaCorrida = '';
    let filtroMotoristaDespesa = '';

    const parametrosCorrida = [
      dataInicio,
      dataFim
    ];

    const parametrosDespesa = [
      dataInicio,
      dataFim
    ];

    if (motorista_id) {

      filtroMotoristaCorrida =
        ' AND motorista_id = ?';

      filtroMotoristaDespesa =
        ' AND motorista_id = ?';

      parametrosCorrida.push(
        Number(motorista_id)
      );

      parametrosDespesa.push(
        Number(motorista_id)
      );
    }

    /*
    ======================================================
    3. MOTORISTAS
    ======================================================
    */

    const [[motoristasTotais]] =
      await pool.query(`
        SELECT COUNT(*) AS total
        FROM motoristas
      `);

    const [[motoristasAtivos]] =
      await pool.query(`
        SELECT COUNT(*) AS total
        FROM motoristas
        WHERE ativo = 1
      `);

    /*
    ======================================================
    4. CORRIDAS
    ======================================================
    */

    const [[arrecadacao]] =
      await pool.query(
        `
        SELECT
          COUNT(*) AS total_corridas,
          COALESCE(SUM(valor_total), 0) AS receita
        FROM corridas
        WHERE DATE(data_corrida)
          BETWEEN ? AND ?
        ${filtroMotoristaCorrida}
        `,
        parametrosCorrida
      );

    /*
    ======================================================
    5. DESPESAS
    ======================================================
    */

    const [[despesas]] =
      await pool.query(
        `
        SELECT
          COUNT(*) AS total_despesas,
          COALESCE(SUM(valor), 0) AS despesas
        FROM despesas
        WHERE DATE(data)
          BETWEEN ? AND ?
        ${filtroMotoristaDespesa}
        `,
        parametrosDespesa
      );

    const totalCorridas =
      Number(arrecadacao.total_corridas || 0);

    const receitaTotal =
      Number(arrecadacao.receita || 0);

    const totalDespesasRegistros =
      Number(despesas.total_despesas || 0);

    const despesasTotal =
      Number(despesas.despesas || 0);

    const saldoGeral =
      receitaTotal - despesasTotal;

    /*
    ======================================================
    6. LISTA DE MOTORISTAS
    ======================================================
    */

    let queryMotoristas = `
      SELECT
        id,
        nome,
        telefone,
        documento,
        email,
        ativo
      FROM motoristas
      WHERE ativo = 1
    `;

    const parametrosMotoristas = [];

    if (motorista_id) {

      queryMotoristas += `
        AND id = ?
      `;

      parametrosMotoristas.push(
        Number(motorista_id)
      );
    }

    queryMotoristas += `
      ORDER BY nome ASC
    `;

    const [motoristas] =
      await pool.query(
        queryMotoristas,
        parametrosMotoristas
      );

    const dadosMotoristas = [];

    for (const motorista of motoristas) {

      /*
      ----------------------------------------------
      CORRIDAS DO MOTORISTA
      ----------------------------------------------
      */

      const [[corridasMotorista]] =
        await pool.query(
          `
          SELECT
            COUNT(*) AS total_corridas,
            COALESCE(SUM(valor_total), 0)
              AS receita
          FROM corridas
          WHERE motorista_id = ?
            AND DATE(data_corrida)
              BETWEEN ? AND ?
          `,
          [
            motorista.id,
            dataInicio,
            dataFim
          ]
        );

      /*
      ----------------------------------------------
      DESPESAS DO MOTORISTA
      ----------------------------------------------
      */

      const [[despesasMotorista]] =
        await pool.query(
          `
          SELECT
            COUNT(*) AS total_despesas,
            COALESCE(SUM(valor), 0)
              AS despesas
          FROM despesas
          WHERE motorista_id = ?
            AND DATE(data)
              BETWEEN ? AND ?
          `,
          [
            motorista.id,
            dataInicio,
            dataFim
          ]
        );

      const totalCorridasMotorista =
        Number(
          corridasMotorista.total_corridas || 0
        );

      const receitaMotorista =
        Number(
          corridasMotorista.receita || 0
        );

      const despesasMotoristaTotal =
        Number(
          despesasMotorista.despesas || 0
        );

      const saldoMotorista =
        receitaMotorista -
        despesasMotoristaTotal;

      dadosMotoristas.push({
        id: motorista.id,
        nome: motorista.nome,
        telefone: motorista.telefone,
        documento: motorista.documento,
        email: motorista.email,
        ativo: motorista.ativo,

        total_corridas:
          totalCorridasMotorista,

        receita:
          receitaMotorista.toFixed(2),

        despesas:
          despesasMotoristaTotal.toFixed(2),

        saldo:
          saldoMotorista.toFixed(2)
      });
    }

    /*
    ======================================================
    7. DADOS PARA GRÁFICO
    ======================================================
    */

    let grafico = [];

    if (tipo === 'diario') {

      grafico = [
        {
          periodo: dataInicio,
          receita: receitaTotal,
          despesas: despesasTotal
        }
      ];

    } else {

      let agrupamento;

      if (tipo === 'semanal') {
        agrupamento = '%Y-%m-%d';
      } else if (tipo === 'mensal') {
        agrupamento = '%Y-%m-%d';
      } else {
        agrupamento = '%Y-%m';
      }

      const [graficoDados] =
        await pool.query(
          `
          SELECT
            DATE_FORMAT(
              data_corrida,
              ?
            ) AS periodo,

            COALESCE(
              SUM(valor_total),
              0
            ) AS receita

          FROM corridas

          WHERE DATE(data_corrida)
            BETWEEN ? AND ?

          ${filtroMotoristaCorrida}

          GROUP BY periodo

          ORDER BY periodo ASC
          `,
          [
            agrupamento,
            dataInicio,
            dataFim,
            ...(motorista_id
              ? [Number(motorista_id)]
              : [])
          ]
        );

      for (const item of graficoDados) {

        const [[despesaPeriodo]] =
          await pool.query(
            `
            SELECT
              COALESCE(
                SUM(valor),
                0
              ) AS despesas

            FROM despesas

            WHERE DATE(data)
              BETWEEN ? AND ?

              AND DATE_FORMAT(
                data,
                ?
              ) = ?

              ${motorista_id
                ? 'AND motorista_id = ?'
                : ''}
            `,
            [
              dataInicio,
              dataFim,
              agrupamento,
              item.periodo,
              ...(motorista_id
                ? [Number(motorista_id)]
                : [])
            ]
          );

        grafico.push({
          periodo: item.periodo,

          receita:
            Number(item.receita || 0),

          despesas:
            Number(
              despesaPeriodo.despesas || 0
            )
        });
      }
    }

    /*
    ======================================================
    8. RESPOSTA
    ======================================================
    */

    return res.json({
      sucesso: true,

      tipo,

      data,

      periodo: {
        inicio: dataInicio,
        fim: dataFim
      },

      motorista_id:
        motorista_id
          ? Number(motorista_id)
          : null,

      totais: {
        motoristas:
          Number(
            motoristasTotais.total || 0
          ),

        motoristas_ativos:
          Number(
            motoristasAtivos.total || 0
          ),

        corridas:
          totalCorridas,

        receita:
          receitaTotal.toFixed(2),

        despesas:
          despesasTotal.toFixed(2),

        total_despesas_registros:
          totalDespesasRegistros,

        saldo:
          saldoGeral.toFixed(2)
      },

      motoristas:
        dadosMotoristas,

      grafico
    });

  } catch (error) {

    console.error(
      'ERRO AO CARREGAR RELATÓRIO:',
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem:
        'Erro ao carregar relatório.',
      erro: error.message
    });
  }
});


/*
========================================================
FUNÇÃO AUXILIAR
========================================================
*/

function formatarData(data) {

  const ano =
    data.getFullYear();

  const mes =
    String(data.getMonth() + 1)
      .padStart(2, '0');

  const dia =
    String(data.getDate())
      .padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}


module.exports = router;