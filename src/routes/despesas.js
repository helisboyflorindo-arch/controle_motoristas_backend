const express = require('express');
const pool = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');
const upload = require('../config/upload');
const router = express.Router();


// ======================================================
// REGISTRAR DESPESA - MOTORISTA
// ======================================================

router.post(
  '/',
  autenticar,
  upload.single('comprovativo'),
  async (req, res) => {
    try {
      const {
        data,
        categoria,
        valor,
        observacao
      } = req.body;

      console.log('DADOS DESPESA:', req.body);
      console.log('ARQUIVO:', req.file);
      console.log('USUARIO:', req.usuario);

      // ==================================================
      // MOTORISTA
      // ==================================================

      const motoristaId = req.usuario.motorista_id;

      if (!motoristaId) {
        return res.status(400).json({
          sucesso: false,
          mensagem:
            'Este utilizador não está associado a um motorista.'
        });
      }

      // ==================================================
      // COMPROVATIVO OBRIGATÓRIO
      // ==================================================

      if (!req.file) {
        return res.status(400).json({
          sucesso: false,
          mensagem:
            'É obrigatório enviar uma foto do comprovativo da despesa.'
        });
      }

      // ==================================================
      // CATEGORIA
      // ==================================================

      if (!categoria || categoria.trim() === '') {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Informe a categoria da despesa.'
        });
      }

      // ==================================================
      // VALOR
      // ==================================================

      const valorNumerico = Number(valor);

      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'O valor da despesa é inválido.'
        });
      }

      // ==================================================
      // DATA
      // ==================================================

      const dataFinal = data || new Date();

      // ==================================================
      // VERIFICAR MOTORISTA
      // ==================================================

      const [motoristas] = await pool.query(
        `
        SELECT id
        FROM motoristas
        WHERE id = ? AND ativo = 1
        `,
        [motoristaId]
      );

      if (motoristas.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem:
            'Motorista não encontrado ou está desativado.'
        });
      }

      // ==================================================
      // URL DA FOTO NO CLOUDINARY
      // ==================================================

      const comprovativoUrl = req.file.path;

      // ==================================================
      // INSERIR DESPESA
      // ==================================================

      const [resultado] = await pool.query(
        `
        INSERT INTO despesas
        (
          motorista_id,
          data,
          categoria,
          valor,
          observacao,
          comprovativo_url
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          motoristaId,
          dataFinal,
          categoria.trim(),
          valorNumerico,
          observacao?.trim() || null,
          comprovativoUrl
        ]
      );

      // ==================================================
      // RESPOSTA
      // ==================================================

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Despesa registrada com sucesso.',
        despesa: {
          id: resultado.insertId,
          motorista_id: motoristaId,
          data: dataFinal,
          categoria: categoria.trim(),
          valor: valorNumerico,
          observacao: observacao?.trim() || null,
          comprovativo_url: comprovativoUrl
        }
      });

    } catch (error) {
      console.error(
        'ERRO AO REGISTRAR DESPESA:',
        error
      );

      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao registrar despesa.',
        erro: error.message
      });
    }
  }
);

// ======================================================
// MINHAS DESPESAS - MOTORISTA
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
            filtro = 'AND DATE(data) = CURDATE()';
        }

        if (periodo === 'mes') {
            filtro = `
                AND YEAR(data) = YEAR(CURDATE())
                AND MONTH(data) = MONTH(CURDATE())
            `;
        }

        const [despesas] = await pool.query(
            `
            SELECT
                id,
                motorista_id,
                data,
                categoria,
                valor,
                observacao,
                created_at
            FROM despesas
            WHERE motorista_id = ?
            ${filtro}
            ORDER BY data DESC, id DESC
            `,
            [motoristaId]
        );

        return res.json({
            sucesso: true,
            periodo,
            despesas
        });

    } catch (error) {
        console.error('ERRO AO LISTAR DESPESAS:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao listar despesas.',
            erro: error.message
        });
    }
});

// ======================================================
// TODAS AS DESPESAS - ADMIN
// ======================================================

router.get('/', autenticar, somenteAdmin, async (req, res) => {
  try {
    const [despesas] = await pool.query(
      `
      SELECT
        d.id,
        d.motorista_id,
        m.nome AS motorista,
        d.data,
        d.categoria,
        d.valor,
        d.observacao,
        d.created_at
        d.comprovativo_url,
      FROM despesas d
      INNER JOIN motoristas m
        ON m.id = d.motorista_id
      ORDER BY d.data DESC, d.id DESC
      `
    );

    return res.json({
      sucesso: true,
      despesas
    });

  } catch (error) {
    console.error('ERRO AO LISTAR DESPESAS ADMIN:', error);

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao listar despesas.',
      erro: error.message
    });
  }
});


module.exports = router;