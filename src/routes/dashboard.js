const express = require('express');
const pool = require('../db');

const {
    autenticar,
    somenteAdmin
} = require('../middleware/auth');

const router = express.Router();


// ======================================================
// DASHBOARD / RELATÓRIO
// ======================================================

router.get(
    '/',
    autenticar,
    somenteAdmin,
    async (req, res) => {

        try {

            const {
                tipo = 'diario',
                data,
                inicio,
                fim,
                motorista_id
            } = req.query;


            // ==================================================
            // VALIDAR TIPO
            // ==================================================

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


            // ==================================================
            // VALIDAR DATA / INTERVALO
            // ==================================================

            if (!data && !inicio && !fim) {

                return res.status(400).json({
                    sucesso: false,
                    mensagem:
                        'Informe uma data ou um intervalo com início e fim.'
                });

            }

            if (
                (inicio && !fim) ||
                (!inicio && fim)
            ) {

                return res.status(400).json({
                    sucesso: false,
                    mensagem:
                        'Informe a data inicial e a data final.'
                });

            }

            if (
                inicio &&
                fim &&
                inicio > fim
            ) {

                return res.status(400).json({
                    sucesso: false,
                    mensagem:
                        'A data inicial não pode ser posterior à data final.'
                });

            }


            // ==================================================
            // DEFINIR PERÍODO
            // ==================================================

            let dataInicio;
            let dataFim;


            // --------------------------------------------------
            // INTERVALO
            // --------------------------------------------------

            if (inicio && fim) {

                dataInicio = inicio;
                dataFim = fim;

            }


            // --------------------------------------------------
            // TIPO
            // --------------------------------------------------

            else {

                if (tipo === 'diario') {

                    dataInicio = data;
                    dataFim = data;

                }


                // ==================================================
                // SEMANAL
                // ==================================================

                else if (tipo === 'semanal') {

                    const partes =
                        data.split('-').map(Number);

                    const selecionada =
                        new Date(
                            partes[0],
                            partes[1] - 1,
                            partes[2]
                        );

                    const diaSemana =
                        selecionada.getDay();

                    const diferenca =
                        diaSemana === 0
                            ? -6
                            : 1 - diaSemana;

                    const inicioSemana =
                        new Date(selecionada);

                    inicioSemana.setDate(
                        selecionada.getDate() + diferenca
                    );

                    const fimSemana =
                        new Date(inicioSemana);

                    fimSemana.setDate(
                        inicioSemana.getDate() + 6
                    );

                    dataInicio =
                        formatarData(inicioSemana);

                    dataFim =
                        formatarData(fimSemana);

                }


                // ==================================================
                // MENSAL
                // ==================================================

                else if (tipo === 'mensal') {

                    const partes =
                        data.split('-').map(Number);

                    const ano = partes[0];
                    const mes = partes[1];

                    const inicioMes =
                        new Date(
                            ano,
                            mes - 1,
                            1
                        );

                    const fimMes =
                        new Date(
                            ano,
                            mes,
                            0
                        );

                    dataInicio =
                        formatarData(inicioMes);

                    dataFim =
                        formatarData(fimMes);

                }


                // ==================================================
                // ANUAL
                // ==================================================

                else if (tipo === 'anual') {

                    const ano =
                        Number(
                            data.split('-')[0]
                        );

                    dataInicio =
                        `${ano}-01-01`;

                    dataFim =
                        `${ano}-12-31`;

                }

            }


            console.log('================================');
            console.log('DASHBOARD');
            console.log('TIPO:', tipo);
            console.log('DATA:', data);
            console.log('INÍCIO:', dataInicio);
            console.log('FIM:', dataFim);
            console.log(
                'MOTORISTA:',
                motorista_id || 'TODOS'
            );
            console.log('================================');


            // ==================================================
            // FILTROS
            // ==================================================

            let filtroMotoristaCorrida = '';
            let filtroMotoristaDespesa = '';
            let filtroMotoristaHiace = '';

            const parametrosCorrida = [
                dataInicio,
                dataFim
            ];

            const parametrosDespesa = [
                dataInicio,
                dataFim
            ];

            const parametrosHiace = [
                dataInicio,
                dataFim
            ];


            if (motorista_id) {

                filtroMotoristaCorrida =
                    ' AND motorista_id = ?';

                filtroMotoristaDespesa =
                    ' AND motorista_id = ?';

                filtroMotoristaHiace =
                    ' AND motorista_id = ?';


                parametrosCorrida.push(
                    Number(motorista_id)
                );

                parametrosDespesa.push(
                    Number(motorista_id)
                );

                parametrosHiace.push(
                    Number(motorista_id)
                );

            }


            // ==================================================
            // MOTORISTAS
            // ==================================================

            const [[motoristasTotais]] =
                await pool.query(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM motoristas
                    WHERE ativo = 1
                    `
                );


            const [[motoristasAtivos]] =
                await pool.query(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM motoristas
                    WHERE ativo = 1
                    `
                );


            // ==================================================
            // CORRIDAS
            // ==================================================

            const [[arrecadacao]] =
                await pool.query(
                    `
                    SELECT

                        COUNT(*) AS total_corridas,

                        COALESCE(
                            SUM(valor_total),
                            0
                        ) AS receita

                    FROM corridas

                    WHERE DATE(data_corrida)
                    BETWEEN ? AND ?

                    ${filtroMotoristaCorrida}
                    `,
                    parametrosCorrida
                );


            const totalCorridas =
                Number(
                    arrecadacao.total_corridas || 0
                );


            const receitaTotal =
                Number(
                    arrecadacao.receita || 0
                );


            // ==================================================
            // DESPESAS
            // ==================================================

            const [[despesas]] =
                await pool.query(
                    `
                    SELECT

                        COUNT(
                            CASE
                                WHEN status = 'aprovada'
                                THEN 1
                            END
                        ) AS total_despesas,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN status = 'aprovada'
                                    THEN valor
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS despesas

                    FROM despesas

                    WHERE DATE(data)
                    BETWEEN ? AND ?

                    ${filtroMotoristaDespesa}
                    `,
                    parametrosDespesa
                );


            const totalDespesasRegistros =
                Number(
                    despesas.total_despesas || 0
                );


            const despesasTotal =
                Number(
                    despesas.despesas || 0
                );


            // ==================================================
            // HIACE
            // ==================================================

            const [[hiaceTotal]] =
                await pool.query(
                    `
                    SELECT

                        COUNT(*) AS viagens,

                        COALESCE(
                            SUM(valor_total),
                            0
                        ) AS receita,

                        COALESCE(
                            SUM(total_passageiros),
                            0
                        ) AS passageiros

                    FROM viagens_hiace

                    WHERE DATE(data_inicio)
                    BETWEEN ? AND ?

                    ${filtroMotoristaHiace}
                    `,
                    parametrosHiace
                );


            const viagensHiace =
                Number(
                    hiaceTotal.viagens || 0
                );


            const receitaTotalHiace =
                Number(
                    hiaceTotal.receita || 0
                );


            const passageirosTotalHiace =
                Number(
                    hiaceTotal.passageiros || 0
                );


            // ==================================================
            // VALOR TOTAL DA OPERAÇÃO
            // ==================================================

            const receitaGeral =
                receitaTotal +
                receitaTotalHiace;


            // ==================================================
            // SALDO GERAL
            // ==================================================

            const saldoGeral =
                receitaGeral -
                despesasTotal;


            // ==================================================
            // VALOR ENTREGUE
            // ==================================================

            const valorEntregue =
                saldoGeral;


            console.log(
                'RECEITA CORRIDAS:',
                receitaTotal
            );

            console.log(
                'RECEITA HIACE:',
                receitaTotalHiace
            );

            console.log(
                'DESPESAS:',
                despesasTotal
            );

            console.log(
                'VALOR ENTREGUE:',
                valorEntregue
            );


            // ==================================================
            // DESPESAS DO ÚLTIMO DIA DO FILTRO
            // ==================================================

            const [[despesasDiaFiltro]] =
                await pool.query(
                    `
                    SELECT

                        COALESCE(
                            SUM(valor),
                            0
                        ) AS despesas_dia

                    FROM despesas

                    WHERE DATE(data) = ?

                    AND status = 'aprovada'

                    ${
                        motorista_id
                            ? 'AND motorista_id = ?'
                            : ''
                    }
                    `,
                    motorista_id
                        ? [
                            dataFim,
                            Number(motorista_id)
                        ]
                        : [dataFim]
                );


            const despesasHojeTotal =
                Number(
                    despesasDiaFiltro.despesas_dia || 0
                );


            // ==================================================
            // LISTA DE MOTORISTAS
            // ==================================================

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


            // ==================================================
            // DADOS POR MOTORISTA
            // ==================================================

            for (const motorista of motoristas) {


                // ==================================================
                // CORRIDAS
                // ==================================================

                const [[corridasMotorista]] =
                    await pool.query(
                        `
                        SELECT

                            COUNT(*) AS total_corridas,

                            COALESCE(
                                SUM(valor_total),
                                0
                            ) AS receita

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


                // ==================================================
                // DESPESAS
                // ==================================================

                const [[despesasMotorista]] =
                    await pool.query(
                        `
                        SELECT

                            COUNT(
                                CASE
                                    WHEN status = 'aprovada'
                                    THEN 1
                                END
                            ) AS total_despesas,

                            COALESCE(
                                SUM(
                                    CASE
                                        WHEN status = 'aprovada'
                                        THEN valor
                                        ELSE 0
                                    END
                                ),
                                0
                            ) AS despesas

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


                // ==================================================
                // HIACE
                // ==================================================

                const [[hiaceMotorista]] =
                    await pool.query(
                        `
                        SELECT

                            COUNT(*) AS viagens,

                            COALESCE(
                                SUM(valor_total),
                                0
                            ) AS receita,

                            COALESCE(
                                SUM(total_passageiros),
                                0
                            ) AS passageiros

                        FROM viagens_hiace

                        WHERE motorista_id = ?

                        AND DATE(data_inicio)
                        BETWEEN ? AND ?
                        `,
                        [
                            motorista.id,
                            dataInicio,
                            dataFim
                        ]
                    );


                // ==================================================
                // VALORES
                // ==================================================

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


                const viagensHiaceMotorista =
                    Number(
                        hiaceMotorista.viagens || 0
                    );


                const receitaHiaceMotorista =
                    Number(
                        hiaceMotorista.receita || 0
                    );


                const passageirosHiaceMotorista =
                    Number(
                        hiaceMotorista.passageiros || 0
                    );


                // ==================================================
                // RECEITA TOTAL MOTORISTA
                // ==================================================

                const receitaTotalMotorista =
                    receitaMotorista +
                    receitaHiaceMotorista;


                // ==================================================
                // SALDO MOTORISTA
                // ==================================================

                const saldoMotorista =
                    receitaTotalMotorista -
                    despesasMotoristaTotal;


                // ==================================================
                // ADICIONAR MOTORISTA
                // ==================================================

                dadosMotoristas.push({

                    id:
                        motorista.id,

                    nome:
                        motorista.nome,

                    telefone:
                        motorista.telefone,

                    documento:
                        motorista.documento,

                    email:
                        motorista.email,

                    ativo:
                        motorista.ativo,


                    // --------------------------
                    // CORRIDAS
                    // --------------------------

                    total_corridas:
                        totalCorridasMotorista,

                    receita:
                        receitaMotorista.toFixed(2),


                    // --------------------------
                    // DESPESAS
                    // --------------------------

                    despesas:
                        despesasMotoristaTotal.toFixed(2),


                    // --------------------------
                    // HIACE
                    // --------------------------

                    viagens_hiace:
                        viagensHiaceMotorista,

                    receita_hiace:
                        receitaHiaceMotorista.toFixed(2),

                    passageiros_hiace:
                        passageirosHiaceMotorista,


                    // --------------------------
                    // TOTAL
                    // --------------------------

                    receita_total:
                        receitaTotalMotorista.toFixed(2),

                    saldo:
                        saldoMotorista.toFixed(2)

                });

            }


            // ==================================================
            // GRÁFICO
            // ==================================================

            let grafico = [];


            const filtroIntervalo =
                inicio && fim;


            let agrupamento;


            if (
                tipo === 'diario' &&
                !filtroIntervalo
            ) {

                grafico = [

                    {
                        periodo:
                            dataInicio,

                        receita:
                            receitaGeral,

                        despesas:
                            despesasTotal
                    }

                ];

            }

            else {

                if (
                    filtroIntervalo ||
                    tipo === 'semanal' ||
                    tipo === 'mensal'
                ) {

                    agrupamento =
                        '%Y-%m-%d';

                }

                else {

                    agrupamento =
                        '%Y-%m';

                }


                // ==================================================
                // GRÁFICO CORRIDAS
                // ==================================================

                const parametrosGraficoCorridas = [
                    agrupamento,
                    dataInicio,
                    dataFim
                ];


                if (motorista_id) {

                    parametrosGraficoCorridas.push(
                        Number(motorista_id)
                    );

                }


                const [graficoCorridas] =
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

                        ${
                            motorista_id
                                ? 'AND motorista_id = ?'
                                : ''
                        }

                        GROUP BY periodo

                        ORDER BY periodo ASC
                        `,
                        parametrosGraficoCorridas
                    );


                // ==================================================
                // GRÁFICO HIACE
                // ==================================================

                const parametrosGraficoHiace = [
                    agrupamento,
                    dataInicio,
                    dataFim
                ];


                if (motorista_id) {

                    parametrosGraficoHiace.push(
                        Number(motorista_id)
                    );

                }


                const [graficoHiace] =
                    await pool.query(
                        `
                        SELECT

                            DATE_FORMAT(
                                data_inicio,
                                ?
                            ) AS periodo,

                            COALESCE(
                                SUM(valor_total),
                                0
                            ) AS receita

                        FROM viagens_hiace

                        WHERE DATE(data_inicio)
                        BETWEEN ? AND ?

                        ${
                            motorista_id
                                ? 'AND motorista_id = ?'
                                : ''
                        }

                        GROUP BY periodo

                        ORDER BY periodo ASC
                        `,
                        parametrosGraficoHiace
                    );


                // ==================================================
                // MAPA DO GRÁFICO
                // ==================================================

                const mapaGrafico = {};


                for (const item of graficoCorridas) {

                    mapaGrafico[item.periodo] = {

                        receita:
                            Number(
                                item.receita || 0
                            ),

                        despesas: 0

                    };

                }


                for (const item of graficoHiace) {

                    if (!mapaGrafico[item.periodo]) {

                        mapaGrafico[item.periodo] = {

                            receita: 0,

                            despesas: 0

                        };

                    }


                    mapaGrafico[item.periodo].receita +=
                        Number(
                            item.receita || 0
                        );

                }


                // ==================================================
                // DESPESAS GRÁFICO
                // ==================================================

                const parametrosDespesasGrafico = [
                    agrupamento,
                    dataInicio,
                    dataFim
                ];


                if (motorista_id) {

                    parametrosDespesasGrafico.push(
                        Number(motorista_id)
                    );

                }


                const [graficoDespesas] =
                    await pool.query(
                        `
                        SELECT

                            DATE_FORMAT(
                                data,
                                ?
                            ) AS periodo,

                            COALESCE(
                                SUM(
                                    CASE
                                        WHEN status = 'aprovada'
                                        THEN valor
                                        ELSE 0
                                    END
                                ),
                                0
                            ) AS despesas

                        FROM despesas

                        WHERE DATE(data)
                        BETWEEN ? AND ?

                        ${
                            motorista_id
                                ? 'AND motorista_id = ?'
                                : ''
                        }

                        GROUP BY periodo

                        ORDER BY periodo ASC
                        `,
                        parametrosDespesasGrafico
                    );


                for (const item of graficoDespesas) {

                    if (!mapaGrafico[item.periodo]) {

                        mapaGrafico[item.periodo] = {

                            receita: 0,

                            despesas: 0

                        };

                    }


                    mapaGrafico[item.periodo].despesas =
                        Number(
                            item.despesas || 0
                        );

                }


                const periodos =
                    Object.keys(
                        mapaGrafico
                    ).sort();


                grafico =
                    periodos.map(
                        periodo => ({

                            periodo,

                            receita:
                                mapaGrafico[
                                    periodo
                                ].receita,

                            despesas:
                                mapaGrafico[
                                    periodo
                                ].despesas

                        })
                    );

            }


            // ==================================================
            // RESPOSTA FINAL
            // ==================================================

            return res.json({

                sucesso: true,

                tipo,

                data:
                    data || null,


                periodo: {

                    inicio:
                        dataInicio,

                    fim:
                        dataFim

                },


                motorista_id:
                    motorista_id
                        ? Number(motorista_id)
                        : null,


                // ==================================================
                // TOTAIS
                // ==================================================

                totais: {

                    motoristas:
                        Number(
                            motoristasTotais.total || 0
                        ),

                    motoristas_ativos:
                        Number(
                            motoristasAtivos.total || 0
                        ),


                    // --------------------------
                    // CORRIDAS
                    // --------------------------

                    corridas:
                        totalCorridas,

                    corridas_hoje:
                        totalCorridas,


                    receita:
                        receitaTotal.toFixed(2),

                    total_arrecadado:
                        receitaTotal.toFixed(2),


                    // --------------------------
                    // HIACE
                    // --------------------------

                    viagens_hiace:
                        viagensHiace,

                    receita_hiace:
                        receitaTotalHiace.toFixed(2),

                    passageiros_hiace:
                        passageirosTotalHiace,


                    // --------------------------
                    // RECEITA GERAL
                    // --------------------------

                    receita_geral:
                        receitaGeral.toFixed(2),


                    // --------------------------
                    // DESPESAS
                    // --------------------------

                    despesas:
                        despesasTotal.toFixed(2),

                    despesas_hoje:
                        despesasHojeTotal.toFixed(2),

                    total_despesas_registros:
                        totalDespesasRegistros,


                    // --------------------------
                    // SALDO
                    // --------------------------

                    saldo:
                        saldoGeral.toFixed(2),

                    saldo_geral:
                        saldoGeral.toFixed(2),


                    // --------------------------
                    // VALOR ENTREGUE
                    // --------------------------

                    valor_entregue:
                        valorEntregue.toFixed(2)

                },


                // ==================================================
                // MOTORISTAS
                // ==================================================

                motoristas:
                    dadosMotoristas,


                // ==================================================
                // GRÁFICO
                // ==================================================

                grafico

            });

        }

        catch (error) {

            console.error(
                '========================================'
            );

            console.error(
                'ERRO DASHBOARD:'
            );

            console.error(error);

            console.error(
                'SQL:',
                error.sql
            );

            console.error(
                'MYSQL:',
                error.sqlMessage
            );

            console.error(
                'MENSAGEM:',
                error.message
            );

            console.error(
                '========================================'
            );


            return res.status(500).json({

                sucesso: false,

                mensagem:
                    'Erro ao carregar relatório.',

                erro:
                    error.message

            });

        }

    }
);


// ======================================================
// FORMATAR DATA
// ======================================================

function formatarData(data) {

    const ano =
        data.getFullYear();

    const mes =
        String(
            data.getMonth() + 1
        ).padStart(
            2,
            '0'
        );

    const dia =
        String(
            data.getDate()
        ).padStart(
            2,
            '0'
        );

    return `${ano}-${mes}-${dia}`;
}


module.exports = router;