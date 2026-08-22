const {
    messaging
} = require('../config/firebase');

const pool = require('../db');

// ======================================
// ENVIAR PARA UM DISPOSITIVO
// motorista específico
// ======================================

async function enviarNotificacao(
    token,
    titulo,
    mensagem
){

    try {


        console.log("==============================");
        console.log("TOKEN RECEBIDO:");
        console.log(token);
        console.log("==============================");


        await messaging.send({

    token: token,

    notification: {

        title: titulo,

        body: mensagem

    }

});



        console.log(
            'Notificação enviada'
        );



    } catch(error){


        console.error(
            'Erro enviar notificação:',
            error
        );


        throw error;

    }

}




// ======================================
// ENVIAR PARA TODOS ADMINISTRADORES
// ======================================


async function enviarNotificacaoAdmins(
    titulo,
    mensagem
){

    try {


        const [dispositivos] = await pool.query(
            `
            SELECT fcm_token
            FROM dispositivos_admin
            WHERE fcm_token IS NOT NULL
            `
        );



        if(dispositivos.length === 0){

            console.log(
                'Nenhum administrador com FCM'
            );

            return;

        }



        const tokens = dispositivos.map(
            item => item.fcm_token
        );



        const resposta =
        await admin.messaging()
        .sendEachForMulticast({

            tokens,

            notification:{

                title: titulo,

                body: mensagem

            }

        });



        console.log(
            'Admins notificados:',
            resposta.successCount
        );



    }catch(error){


        console.error(
            'Erro FCM admins:',
            error
        );


        throw error;

    }

}




module.exports = {

    enviarNotificacao,

    enviarNotificacaoAdmins

};