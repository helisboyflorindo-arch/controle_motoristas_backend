const pool = require('../db');

const {
    enviarNotificacao
} = require('./notificacao_service');



// ============================================
// NOTIFICAR TODOS ADMINISTRADORES
// usa tabela dispositivos
// ============================================


async function notificarAdmins(
    titulo,
    mensagem
){

    try {


        const [admins] = await pool.query(

        `
        SELECT

            d.fcm_token,
            u.nome

        FROM dispositivos d


        INNER JOIN usuarios u

        ON u.id = d.usuario_id


        WHERE u.tipo = 'admin'

        AND d.ativo = 1

        AND d.fcm_token IS NOT NULL

        `

        );



        console.log(
            'Admins encontrados:',
            admins.length
        );



        for(const admin of admins){


            await enviarNotificacao(

                admin.fcm_token,

                titulo,

                mensagem

            );


            console.log(
                'Admin notificado:',
                admin.nome
            );


        }



    }catch(error){


        console.error(

            'Erro notificar admins:',

            error

        );


    }


}




// ============================================
// NOTIFICAR UM UTILIZADOR
// motorista específico
// ============================================


async function notificarUsuario(

    usuarioId,

    titulo,

    mensagem

){


    try {



        const [dispositivos] = await pool.query(

            `

            SELECT 
                fcm_token

            FROM dispositivos

            WHERE usuario_id = ?

            AND ativo = 1

            `,

            [
                usuarioId
            ]

        );





        console.log(

            'Dispositivos utilizador:',

            dispositivos.length

        );





        for(const dispositivo of dispositivos){



            await enviarNotificacao(

                dispositivo.fcm_token,

                titulo,

                mensagem

            );


        }



    }catch(error){


        console.error(

            'Erro notificar utilizador:',

            error

        );


    }


}




module.exports = {

    notificarAdmins,

    notificarUsuario

};