const pool = require('../db');


// ======================================
// GUARDAR HISTÓRICO DE NOTIFICAÇÃO
// ======================================

async function criarNotificacao(
    usuarioId,
    titulo,
    mensagem,
    tipo,
    referenciaId
){

    try {


        await pool.query(

        `
        INSERT INTO notificacoes
(
usuario_id,
titulo,
mensagem,
tipo,
referencia_id
)

VALUES (?,?,?,?,?)

        `,

        [
 usuarioId,
 titulo,
 mensagem,
 tipo,
 referenciaId
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