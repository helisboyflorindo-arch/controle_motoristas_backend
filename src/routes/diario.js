const express = require('express');
const pool = require('../db');
const {
    autenticar,
    somenteAdmin
} = require('../middleware/auth');

const router = express.Router();

router.get(
    '/:motorista_id',
    autenticar,
    somenteAdmin,
    async (req, res) => {

        try {

            const { motorista_id } = req.params;
            const { data } = req.query;

            if (!data) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem:
                        'Informe a data. Exemplo: ?data=2026-08-16'
                });
            }

            const [motoristas] = await pool.query(
                `
                SELECT
                    id,
                    nome,
                    telefone,
                    documento,
                    email,
                    ativo
                FROM motoristas
                WHERE id = ?
                `,
                [motorista_id]
            );

            if (motoristas.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Motorista não encontrado.'
                });
            }

            const motorista = motoristas[0];

            // ==========================================
            // CORRIDAS DO DIA
            // ==========================================

            const [corridas] = await pool.query(
                `
                SELECT
                    id,
                    motorista_id,
                    data_corrida,
                    valor,
                    valor_total,
                    local_partida,
                    local_termino,
                    quantidade,
                    observacao,
                    created_at
                FROM corridas
                WHERE motorista_id = ?
                  AND DATE(data_corrida) = ?
                ORDER BY data_corrida ASC
                `,
                [
                    motorista_id,
                    data
                ]
            );

            // ==========================================
            // DESPESAS DO DIA
            // ==========================================

            const [despesas] = await pool.query(
                `
                SELECT
                    id,
                    motorista_id,
                    data,
                    categoria,
                    valor,
                    observacao
                FROM despesas
                WHERE motorista_id = ?
                  AND DATE(data) = ?
                ORDER BY data ASC
                `,
                [
                    motorista_id,
                    data
                ]
            );

            // ==========================================
            // TOTAIS
            // ==========================================

            const receita =
                corridas.reduce(
                    (total, corrida) =>
                        total +
                        Number(
                            corrida.valor_total || 0
                        ),
                    0
                );

            const totalDespesas =
                despesas.reduce(
                    (total, despesa) =>
                        total +
                        Number(
                            despesa.valor || 0
                        ),
                    0
                );

            const valorEntregue =
                receita - totalDespesas;

            const totalCorridas =
                corridas.reduce(
                    (total, corrida) =>
                        total +
                        Number(
                            corrida.quantidade || 0
                        ),
                    0
                );

            return res.json({

                sucesso: true,

                motorista,

                resumo: {
                    data,
                    total_corridas:
                        totalCorridas,
                    receita:
                        receita.toFixed(2),
                    despesas:
                        totalDespesas.toFixed(2),
                    valor_entregue:
                        valorEntregue.toFixed(2)
                },

                corridas,

                despesas
            });

        } catch (error) {

            console.error(
                'ERRO NO DIÁRIO:',
                error
            );

            return res.status(500).json({
                sucesso: false,
                mensagem:
                    'Erro ao consultar o resumo diário.',
                erro: error.message
            });
        }
    }
);

module.exports = router;