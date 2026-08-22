const pool = require('../db');
const { enviarNotificacao } = require('./notificacao_service');


async function notificarAdmins(
    titulo,
    mensagem
) {

    try {


        const [admins] = await pool.query(
            `
            SELECT 
                d.id,
                d.fcm_token,
                u.nome

            FROM dispositivos_admin d

            INNER JOIN usuarios u
                ON u.id = d.usuario_id

            WHERE d.fcm_token IS NOT NULL
            `
        );


        console.log(
            'Dispositivos administradores encontrados:',
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
                admin.nome,
                'Dispositivo:',
                admin.id
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