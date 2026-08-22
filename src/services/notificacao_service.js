const admin = require('firebase-admin');
const pool = require('../db');


async function enviarNotificacaoAdmins(titulo, mensagem){

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



        const resposta = await admin.messaging()
        .sendEachForMulticast({

            tokens,

            notification:{

                title: titulo,

                body: mensagem

            }

        });



        console.log(
            'Notificações enviadas:',
            resposta.successCount
        );


        console.log(
            'Falharam:',
            resposta.failureCount
        );



    } catch(error){

        console.error(
            'Erro FCM múltiplo:',
            error
        );

    }


}



module.exports = enviarNotificacaoAdmins;