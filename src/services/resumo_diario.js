const cron = require('node-cron');
const pool = require('../db');

const {
    enviarNotificacao
} = require('./notificacao_service');


const {
    criarNotificacao
} = require('./notificacao_database');

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


        // Despesas aprovadas do dia
        const [despesas] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM despesas
            WHERE DATE(created_at) = CURDATE()
            AND status = 'aprovada'
            `
        );



        // Buscar admins
        const [admins] = await pool.query(
            `
            SELECT

                usuario_id,
                fcm_token

            FROM dispositivos_admin

            WHERE fcm_token IS NOT NULL

            `
        );



        const mensagem = `
📊 Resumo diário

🚗 Corridas registadas: ${corridas[0].total}

💰 Despesas aprovadas: ${despesas[0].total}

Sistema Helisan Fleet Manager
        `;



        for(const admin of admins){


            await criarNotificacao(

                admin.usuario_id,

                'Resumo diário 📊',

                mensagem

            );



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
// Todos os dias às 19h
cron.schedule(
    '0 19 * * *',
    () => {
        enviarResumoDiario();
    }
);


module.exports = {
    enviarResumoDiario
};