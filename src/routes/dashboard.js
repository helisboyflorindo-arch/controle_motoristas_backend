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
            // VALIDAR DATA OU INTERVALO
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


            // FILTRO POR INTERVALO
            if (inicio && fim) {

                dataInicio = inicio;

                dataFim = fim;

            }

            // FILTRO POR UMA DATA / TIPO
            else {

                if (tipo === 'diario') {

                    dataInicio = data;

                    dataFim = data;

                }

                else if (tipo === 'semanal') {

                    const [
                        ano,
                        mes,
                        dia
                    ] = data
                        .split('-')
                        .map(Number);


                    const selecionada =
                        new Date(
                            ano,
                            mes - 1,
                            dia
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

                        selecionada.getDate()
                        + diferenca

                    );


                    const fimSemana =
                        new Date(inicioSemana);


                    fimSemana.setDate(

                        inicioSemana.getDate()
                        + 6

                    );


                    dataInicio =
                        formatarData(
                            inicioSemana
                        );


                    dataFim =
                        formatarData(
                            fimSemana
                        );

                }

                else if (tipo === 'mensal') {

                    const [
                        ano,
                        mes
                    ] = data
                        .split('-')
                        .map(Number);


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
                        formatarData(
                            inicioMes
                        );


                    dataFim =
                        formatarData(
                            fimMes
                        );

                }

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


            console.log(
                '=============================='
            );

            console.log(
                'FILTRO DASHBOARD'
            );

            console.log(
                'TIPO:',
                tipo
            );

            console.log(
                'DATA:',
                data
            );

            console.log(
                'INÍCIO:',
                dataInicio
            );

            console.log(
                'FIM:',
                dataFim
            );

            console.log(
                'MOTORISTA:',
                motorista_id || 'TODOS'
            );

            console.log(
                '=============================='
            );


            // ==================================================
            // FILTRO MOTORISTA
            // ==================================================

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
            // CORRIDAS / ARRECADAÇÃO
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


            // ==================================================
            // DESPESAS APROVADAS
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


            // ==================================================
            // TOTAIS
            // ==================================================

            const totalCorridas =
                Number(
                    arrecadacao.total_corridas || 0
                );


            const receitaTotal =
                Number(
                    arrecadacao.receita || 0
                );


            const totalDespesasRegistros =
                Number(
                    despesas.total_despesas || 0
                );


            const despesasTotal =
                Number(
                    despesas.despesas || 0
                );


            const saldoGeral =
                receitaTotal
                - despesasTotal;


            // ==================================================
            // LISTA MOTORISTAS
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


            for (const motorista of motoristas) {


                // ==============================================
                // CORRIDAS MOTORISTA
                // ==============================================

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


                // ==============================================
                // DESPESAS MOTORISTA
                // ==============================================

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


                const totalCorridasMotorista =
                    Number(
                        corridasMotorista
                            .total_corridas || 0
                    );


                const receitaMotorista =
                    Number(
                        corridasMotorista
                            .receita || 0
                    );


                const despesasMotoristaTotal =
                    Number(
                        despesasMotorista
                            .despesas || 0
                    );


                const saldoMotorista =
                    receitaMotorista
                    - despesasMotoristaTotal;


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

                    total_corridas:
                        totalCorridasMotorista,

                    receita:
                        receitaMotorista
                            .toFixed(2),

                    despesas:
                        despesasMotoristaTotal
                            .toFixed(2),

                    saldo:
                        saldoMotorista
                            .toFixed(2)

                });

            }
                        // ==================================================
            // GRÁFICO
            // ==================================================

            let grafico = [];


            /*
             * Se foi enviado início/fim,
             * agrupamos por dia.
             */

            const filtroIntervalo =
                inicio && fim;


            if (
                tipo === 'diario'
                &&
                !filtroIntervalo
            ) {

                grafico = [

                    {

                        periodo:
                            dataInicio,

                        receita:
                            receitaTotal,

                        despesas:
                            despesasTotal

                    }

                ];

            }

            else {

                let agrupamento;


                if (
                    filtroIntervalo
                    ||
                    tipo === 'semanal'
                    ||
                    tipo === 'mensal'
                ) {

                    agrupamento =
                        '%Y-%m-%d';

                }

                else {

                    agrupamento =
                        '%Y-%m';

                }


                const parametrosGrafico = [

                    agrupamento,

                    dataInicio,

                    dataFim

                ];


                if (motorista_id) {

                    parametrosGrafico.push(

                        Number(motorista_id)

                    );

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


                        ${
                            motorista_id
                                ? 'AND motorista_id = ?'
                                : ''
                        }


                        GROUP BY periodo


                        ORDER BY periodo ASC
                        `,

                        parametrosGrafico

                    );


                for (
                    const item
                    of graficoDados
                ) {


                    const parametrosDespesaGrafico = [

                        dataInicio,

                        dataFim,

                        agrupamento,

                        item.periodo

                    ];


                    if (motorista_id) {

                        parametrosDespesaGrafico.push(

                            Number(motorista_id)

                        );

                    }


                    const [[despesaPeriodo]] =
                        await pool.query(

                            `
                            SELECT

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


                            AND DATE_FORMAT(
                                data,
                                ?
                            ) = ?


                            ${
                                motorista_id
                                    ? 'AND motorista_id = ?'
                                    : ''
                            }
                            `,

                            parametrosDespesaGrafico

                        );


                    grafico.push({

                        periodo:
                            item.periodo,

                        receita:
                            Number(
                                item.receita || 0
                            ),

                        despesas:
                            Number(
                                despesaPeriodo
                                    .despesas || 0
                            )

                    });

                }

            }


            // ==================================================
            // RESPOSTA
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

                    /*
                     * Compatibilidade com o teu
                     * DashboardModel Flutter.
                     */
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


                motoristas:
                    dadosMotoristas,


                grafico

            });


        } catch (error) {


            console.error(
                '========================================'
            );


            console.error(
                'ERRO DASHBOARD COMPLETO:',
                error
            );


            console.error(
                'ERRO SQL:',
                error.sql
            );


            console.error(
                'ERRO MYSQL:',
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
// FUNÇÃO AUXILIAR
// ======================================================

function formatarData(data) {

    const ano =
        data.getFullYear();


    const mes =
        String(
            data.getMonth() + 1
        )
        .padStart(
            2,
            '0'
        );


    const dia =
        String(
            data.getDate()
        )
        .padStart(
            2,
            '0'
        );


    return `${ano}-${mes}-${dia}`;

}


module.exports = router;