const pool = require('../db');


// ======================================
// GUARDAR HISTÓRICO DE NOTIFICAÇÃO
// ======================================

async function criarNotificacao(
    usuarioId,
    titulo,
    mensagem
){

    try {


        await pool.query(

        `
        INSERT INTO notificacoes
        (
            usuario_id,
            titulo,
            mensagem
        )

        VALUES
        (?,?,?)

        `,

        [
            usuarioId,
            titulo,
            mensagem
        ]

        );


        console.log(
            'Notificação guardada no histórico:',
            usuarioId
        );



    } catch(error){


        console.error(
            'Erro guardar notificação:',
            error
        );


    }

}



module.exports = {

    criarNotificacao

};