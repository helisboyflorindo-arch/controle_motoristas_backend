const express = require('express');
const router = express.Router();

const pool = require('../db');


// ======================================
// RECEBER GPS DO MOTORISTA
// ======================================

router.post('/enviar', async (req, res) => {

    try {

        const {
            motorista_id,
            latitude,
            longitude,
            velocidade
        } = req.body;


        if (
            !motorista_id ||
            latitude === undefined ||
            longitude === undefined
        ) {

            return res.status(400).json({
                mensagem: 'Dados GPS incompletos'
            });

        }


        await pool.query(
            `
            INSERT INTO localizacoes
            (
                motorista_id,
                latitude,
                longitude,
                velocidade
            )
            VALUES (?,?,?,?)
            `,
            [
                motorista_id,
                latitude,
                longitude,
                velocidade || 0
            ]
        );


        res.json({
            sucesso: true,
            mensagem: 'Localização atualizada'
        });


    } catch(error) {

    console.error('ERRO GPS:', error);

    res.status(500).json({
        sucesso: false,
        erro: error.message,
        codigo: error.code
    });

}

});


// ======================================
// LISTAR GPS DOS MOTORISTAS
// ======================================

router.get('/motoristas', async (req,res)=>{

    try {


        const [dados] = await pool.query(
            `
            SELECT 
                l.*,
                m.nome

            FROM localizacoes l

            INNER JOIN motoristas m
            ON m.id = l.motorista_id

            ORDER BY l.data_registro DESC
            `
        );


        res.json(dados);


    } catch(error){

        console.error(error);

        res.status(500).json({
            mensagem:'Erro ao buscar GPS'
        });

    }


});


module.exports = router;