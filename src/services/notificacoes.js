const express = require('express');
const pool = require('../db');

const {
    autenticar
} = require('../middleware/auth');


const router = express.Router();



// ==========================================
// LISTAR NOTIFICAÇÕES DO UTILIZADOR
// ==========================================

router.get(
'/',
autenticar,

async(req,res)=>{


try{


const usuarioId = req.usuario.id;



const [notificacoes] = await pool.query(

`
SELECT

id,
titulo,
mensagem,
lida,
created_at

FROM notificacoes

WHERE usuario_id = ?

ORDER BY id DESC

LIMIT 50

`,

[
usuarioId
]

);



return res.json({

sucesso:true,

notificacoes

});



}catch(error){


console.error(
'Erro buscar notificações:',
error
);



return res.status(500).json({

sucesso:false,

mensagem:'Erro ao buscar notificações.'

});


}


}

);

// ==========================================
// CONTAR NOTIFICAÇÕES NÃO LIDAS
// ==========================================

router.get(
'/contador',
autenticar,

async(req,res)=>{

try{

const usuarioId = req.usuario.id;


const [resultado] = await pool.query(

`
SELECT COUNT(*) AS total

FROM notificacoes

WHERE usuario_id = ?

AND lida = 0

`,

[
usuarioId
]

);


return res.json({

sucesso:true,

total: resultado[0].total

});


}catch(error){

console.error(
'Erro contador notificações:',
error
);


return res.status(500).json({

sucesso:false,

erro:error.message

});


}


}

);


module.exports = router;