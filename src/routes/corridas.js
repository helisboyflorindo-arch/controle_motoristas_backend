const express = require('express');
const pool = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();


// ======================================================
// REGISTRAR CORRIDA
// ======================================================

router.post('/', autenticar, async (req, res) => {
    try {
        const {
            origem,
            destino,
            quantidade,
            valor,
            data
        } = req.body;

        // ======================================================
        // VALIDAR CAMPOS
        // ======================================================

        if (!origem || !destino || !quantidade || valor === undefined || valor === null) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Origem, destino, quantidade e valor são obrigatórios.'
            });
        }

        // ======================================================
        // MOTORISTA DO USUÁRIO LOGADO
        // ======================================================

        const motoristaId = req.usuario.motorista_id;

        if (!motoristaId) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Este usuário não está associado a um motorista.'
            });
        }

        // ======================================================
        // CONVERTER VALORES
        // ======================================================

        const quantidadeNumerica = Number(quantidade);
        const valorNumerico = Number(valor);

        if (
            !Number.isInteger(quantidadeNumerica) ||
            quantidadeNumerica <= 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A quantidade deve ser um número inteiro maior que zero.'
            });
        }

        if (
            Number.isNaN(valorNumerico) ||
            valorNumerico < 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O valor informado é inválido.'
            });
        }

        // ======================================================
        // CALCULAR VALOR TOTAL
        // ======================================================

        const valorTotal = quantidadeNumerica * valorNumerico;

        // ======================================================
        // DATA
        // ======================================================

        const dataFinal = data || new Date();


        // ======================================================
        // SALVAR NO BANCO
        // ======================================================

        const [resultado] = await pool.query(
            `
            INSERT INTO corridas
            (
                motorista_id,
                data,
                quantidade,
                valor,
                valor_total,
                origem,
                destino
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                motoristaId,
                dataFinal,
                quantidadeNumerica,
                valorNumerico,
                valorTotal,
                origem,
                destino
            ]
        );


        // ======================================================
        // RESPOSTA
        // ======================================================

        return res.status(201).json({
            sucesso: true,
            mensagem: 'Corrida registrada com sucesso.',

            corrida: {
                id: resultado.insertId,
                motorista_id: motoristaId,
                data: dataFinal,
                quantidade: quantidadeNumerica,
                valor: valorNumerico,
                valor_total: valorTotal,
                origem,
                destino
            }
        });

    } catch (error) {

        console.error(
            'Erro ao registrar corrida:',
            error
        );

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao registrar corrida.',
            erro: error.message
        });
    }
});

// ======================================================
// MINHAS CORRIDAS - MOTORISTA
// ======================================================

router.get('/minhas', autenticar, async (req, res) => {
    try {
        const motoristaId = req.usuario.motorista_id;
        const periodo = req.query.periodo || 'tudo';

        if (!motoristaId) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Este utilizador não está associado a um motorista.'
            });
        }

        let filtro = '';

        if (periodo === 'hoje') {
            filtro = 'AND DATE(data_corrida) = CURDATE()';
        }

        if (periodo === 'mes') {
            filtro = `
                AND YEAR(data_corrida) = YEAR(CURDATE())
                AND MONTH(data_corrida) = MONTH(CURDATE())
            `;
        }

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
            ${filtro}
            ORDER BY data_corrida DESC, id DESC
            `,
            [motoristaId]
        );

        return res.json({
            sucesso: true,
            periodo,
            corridas
        });

    } catch (error) {
        console.error('ERRO AO LISTAR CORRIDAS:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao listar corridas.',
            erro: error.message
        });
    }
});


// ======================================================
// TODAS AS CORRIDAS - ADMIN
// ======================================================

router.get('/', autenticar, somenteAdmin, async (req, res) => {
    try {

        const [corridas] = await pool.query(
            `
            SELECT
                c.id,
                c.motorista_id,
                m.nome AS motorista,
                c.data,
                c.quantidade,
                c.valor,
                c.valor_total,
                c.origem,
                c.destino,
                c.observacao,
                c.created_at
            FROM corridas c
            INNER JOIN motoristas m
                ON m.id = c.motorista_id
            ORDER BY c.data DESC, c.id DESC
            `
        );

        return res.json({
            sucesso: true,
            corridas
        });

    } catch (error) {

        console.error(
            'Erro ao listar corridas:',
            error
        );

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao listar corridas.',
            erro: error.message
        });
    }
});

// ======================================================
// RESUMO FINANCEIRO DO MOTORISTA
// ======================================================

router.get('/resumo', autenticar, async (req, res) => {
    try {
        const motoristaId = req.usuario.motorista_id;

        if (!motoristaId) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Este utilizador não está associado a um motorista.'
            });
        }

        const periodo = req.query.periodo || 'tudo';

        let filtroCorrida = '';
        let filtroDespesa = '';

        if (periodo === 'hoje') {
            filtroCorrida = 'AND DATE(data_corrida) = CURDATE()';
            filtroDespesa = 'AND DATE(data) = CURDATE()';
        }

        if (periodo === 'mes') {
            filtroCorrida =
                'AND YEAR(data_corrida) = YEAR(CURDATE()) ' +
                'AND MONTH(data_corrida) = MONTH(CURDATE())';

            filtroDespesa =
                'AND YEAR(data) = YEAR(CURDATE()) ' +
                'AND MONTH(data) = MONTH(CURDATE())';
        }

        const [ganhos] = await pool.query(
            `
            SELECT COALESCE(SUM(valor_total), 0) AS total_ganho
            FROM corridas
            WHERE motorista_id = ?
            ${filtroCorrida}
            `,
            [motoristaId]
        );

        const [gastos] = await pool.query(
            `
            SELECT COALESCE(SUM(valor), 0) AS total_gasto
            FROM despesas
            WHERE motorista_id = ?
            ${filtroDespesa}
            `,
            [motoristaId]
        );

        const totalGanho = Number(ganhos[0].total_ganho || 0);
        const totalGasto = Number(gastos[0].total_gasto || 0);
        const dinheiroAtual = totalGanho - totalGasto;

        return res.json({
            sucesso: true,
            periodo,
            total_ganho: totalGanho,
            total_gasto: totalGasto,
            dinheiro_atual: dinheiroAtual
        });

    } catch (error) {
        console.error('ERRO AO BUSCAR RESUMO:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar resumo financeiro.',
            erro: error.message
        });
    }
});

// ======================================================
// BUSCAR CORRIDA POR ID
// ======================================================

router.get('/:id', autenticar, async (req, res) => {
    try {

        const { id } = req.params;

        const [corridas] = await pool.query(
            `
            SELECT
                c.id,
                c.motorista_id,
                m.nome AS motorista,
                c.data,
                c.quantidade,
                c.valor,
                c.valor_total,
                c.origem,
                c.destino,
                c.observacao,
                c.created_at
            FROM corridas c
            INNER JOIN motoristas m
                ON m.id = c.motorista_id
            WHERE c.id = ?
            `,
            [id]
        );

        if (corridas.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Corrida não encontrada.'
            });
        }

        const corrida = corridas[0];

        // ======================================================
        // MOTORISTA SÓ PODE VER A PRÓPRIA CORRIDA
        // ======================================================

        if (
            req.usuario.tipo !== 'admin' &&
            corrida.motorista_id !== req.usuario.motorista_id
        ) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso negado.'
            });
        }

        return res.json({
            sucesso: true,
            corrida
        });

    } catch (error) {

        console.error(
            'Erro ao buscar corrida:',
            error
        );

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar corrida.',
            erro: error.message
        });
    }
});


// ======================================================
// EDITAR CORRIDA
// ======================================================

router.put('/:id', autenticar, async (req, res) => {
    try {

        const { id } = req.params;

        const {
            origem,
            destino,
            quantidade,
            valor,
            data
        } = req.body;

        if (
            !origem ||
            !destino ||
            !quantidade ||
            valor === undefined ||
            valor === null
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Origem, destino, quantidade e valor são obrigatórios.'
            });
        }

        const quantidadeNumerica = Number(quantidade);
        const valorNumerico = Number(valor);

        if (
            !Number.isInteger(quantidadeNumerica) ||
            quantidadeNumerica <= 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Quantidade inválida.'
            });
        }

        if (
            Number.isNaN(valorNumerico) ||
            valorNumerico < 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Valor inválido.'
            });
        }

        // ======================================================
        // VERIFICAR CORRIDA
        // ======================================================

        const [corridas] = await pool.query(
            `
            SELECT motorista_id
            FROM corridas
            WHERE id = ?
            `,
            [id]
        );

        if (corridas.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Corrida não encontrada.'
            });
        }

        const motoristaId = corridas[0].motorista_id;

        // Motorista só pode editar a própria corrida
        if (
            req.usuario.tipo !== 'admin' &&
            motoristaId !== req.usuario.motorista_id
        ) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso negado.'
            });
        }

        const valorTotal =
            quantidadeNumerica * valorNumerico;

        const dataFinal = data || new Date();

        await pool.query(
            `
            UPDATE corridas
            SET
                data = ?,
                quantidade = ?,
                valor = ?,
                valor_total = ?,
                origem = ?,
                destino = ?
            WHERE id = ?
            `,
            [
                dataFinal,
                quantidadeNumerica,
                valorNumerico,
                valorTotal,
                origem,
                destino,
                id
            ]
        );

        return res.json({
            sucesso: true,
            mensagem: 'Corrida atualizada com sucesso.'
        });

    } catch (error) {

        console.error(
            'Erro ao atualizar corrida:',
            error
        );

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao atualizar corrida.',
            erro: error.message
        });
    }
});


// ======================================================
// EXCLUIR CORRIDA
// ======================================================

router.delete('/:id', autenticar, async (req, res) => {
    try {

        const { id } = req.params;

        const [corridas] = await pool.query(
            `
            SELECT motorista_id
            FROM corridas
            WHERE id = ?
            `,
            [id]
        );

        if (corridas.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Corrida não encontrada.'
            });
        }

        const motoristaId = corridas[0].motorista_id;

        // Motorista só pode apagar a própria corrida
        if (
            req.usuario.tipo !== 'admin' &&
            motoristaId !== req.usuario.motorista_id
        ) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso negado.'
            });
        }

        await pool.query(
            `
            DELETE FROM corridas
            WHERE id = ?
            `,
            [id]
        );

        return res.json({
            sucesso: true,
            mensagem: 'Corrida excluída com sucesso.'
        });

    } catch (error) {

        console.error(
            'Erro ao excluir corrida:',
            error
        );

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao excluir corrida.',
            erro: error.message
        });
    }
});


module.exports = router;