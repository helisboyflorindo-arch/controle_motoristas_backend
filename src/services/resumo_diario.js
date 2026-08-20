const cron = require('node-cron');
const pool = require('../db');
const { enviarNotificacao } = require('./notificacao_service');


async function enviarResumoDiario() {

    try {


        // Corridas do dia
        const [corridas] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM corridas
            WHERE DATE(created_at) = CURDATE()
            `
        );


        // Despesas do dia
        const [despesas] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM despesas
            WHERE DATE(created_at) = CURDATE()
            `
        );


        // Buscar admins
        const [admins] = await pool.query(
            `
            SELECT fcm_token
            FROM usuarios
            WHERE tipo='admin'
            AND fcm_token IS NOT NULL
            `
        );


        const mensagem = `
📊 Resumo diário

🚗 Corridas registadas: ${corridas[0].total}

💰 Despesas registadas: ${despesas[0].total}

Sistema Controle de Motoristas
        `;


        for(const admin of admins){

            await enviarNotificacao(
                admin.fcm_token,
                'Resumo diário 📊',
                mensagem
            );

        }


        console.log(
            'Resumo diário enviado'
        );


    } catch(error){

        console.error(
            'Erro resumo diário:',
            error
        );

    }

}



// Todos os dias às 18h
cron.schedule(
    '0 19 * * *',
    () => {
        enviarResumoDiario();
    }
);


module.exports = {
    enviarResumoDiario
};