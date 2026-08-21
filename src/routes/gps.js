const express = require('express');
const router = express.Router();

const pool = require('../db');

function calcularDistancia(lat1, lon1, lat2, lon2) {

    const R = 6371; // km

    const dLat = 
        (lat2 - lat1) * Math.PI / 180;

    const dLon =
        (lon2 - lon1) * Math.PI / 180;


    const a =
        Math.sin(dLat/2) *
        Math.sin(dLat/2) +

        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) *
        Math.sin(dLon/2);


    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1-a)
        );


    return R * c;

}






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

        const [ultimo] = await pool.query(
            `
            SELECT latitude, longitude
            FROM localizacoes
            WHERE motorista_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [motorista_id]
            );

            let distancia = 0;


            if(ultimo.length > 0){

            distancia = calcularDistancia(
                Number(ultimo[0].latitude),
                Number(ultimo[0].longitude),
                Number(latitude),
                Number(longitude)
            );

            }
            if(distancia < 0.01){

 distancia = 0;

}

if(distancia > 0){

await pool.query(
`
INSERT INTO motorista_km
(motorista_id,data,km)

VALUES(?,?,?)

ON DUPLICATE KEY UPDATE

km = km + VALUES(km)

`,
[
motorista_id,
new Date(),
distancia
]
);

}


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