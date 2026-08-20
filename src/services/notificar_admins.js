const pool = require('../db');
const { enviarNotificacao } = require('./notificacao_service');


async function notificarAdmins(
    titulo,
    mensagem
) {

    try {


        const [admins] = await pool.query(
            `
            SELECT id, nome, fcm_token
            FROM usuarios
            WHERE tipo = 'admin'
            AND fcm_token IS NOT NULL
            `
        );


        console.log(
            'Administradores encontrados:',
            admins.length
        );


        for (const admin of admins) {


            await enviarNotificacao(
                admin.fcm_token,
                titulo,
                mensagem
            );


            console.log(
                'Notificado:',
                admin.nome
            );

        }


    } catch(error) {


        console.error(
            'Erro ao notificar administradores:',
            error
        );


    }

}


module.exports = {
    notificarAdmins
};