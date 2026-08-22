const express = require('express');
const pool = require('../db');

const {
    autenticar,
    somenteAdmin
} = require('../middleware/auth');

const upload = require('../config/upload');


const {
    notificarAdmins
} = require('../services/notificar_admins');


const {
    notificarUsuario
} = require('../services/notificacao_usuarios');


const router = express.Router();



// ======================================================
// REGISTAR DESPESA - MOTORISTA
// ======================================================


router.post(
'/',
autenticar,
upload.single('comprovativo'),

async(req,res)=>{


try{


const {

data,
categoria,
valor,
observacao

}=req.body || {};



const motoristaId =
req.usuario?.motorista_id;



if(!motoristaId){

return res.status(400).json({

sucesso:false,

mensagem:
'Motorista não encontrado.'

});

}




if(!req.file){

return res.status(400).json({

sucesso:false,

mensagem:
'Envie o comprovativo da despesa.'

});

}




const valorNumerico =
Number(valor);



if(
!Number.isFinite(valorNumerico)
||
valorNumerico <=0

){

return res.status(400).json({

sucesso:false,

mensagem:
'Valor inválido.'

});

}




const comprovativoUrl =
req.file.path;




const dataFinal =
data || new Date();




// verificar motorista

const [motoristas] =
await pool.query(

`
SELECT id
FROM motoristas
WHERE id = ?
AND ativo = 1

`,

[motoristaId]

);



if(motoristas.length===0){

return res.status(404).json({

sucesso:false,

mensagem:
'Motorista inexistente.'

});

}





// inserir despesa


const [resultado] =
await pool.query(

`

INSERT INTO despesas

(
motorista_id,
data,
categoria,
valor,
observacao,
comprovativo_url,
status
)

VALUES

(?,?,?,?,?,?,?)

`,

[

motoristaId,
dataFinal,
categoria.trim(),
valorNumerico,
observacao || null,
comprovativoUrl,
'pendente'

]


);




// ===============================
// NOTIFICAR ADMINISTRADORES
// ===============================


await notificarAdmins(

'Nova despesa registada',

`${req.usuario.nome} registou uma despesa de ${valorNumerico} Kz`

);





return res.status(201).json({

sucesso:true,

mensagem:
'Despesa registada com sucesso.',


id:
resultado.insertId


});



}catch(error){


console.error(
'ERRO DESPESA:',
error
);



return res.status(500).json({

sucesso:false,

mensagem:
'Erro ao registar despesa.',

erro:error.message

});


}


});




// ======================================================
// MINHAS DESPESAS - MOTORISTA
// ======================================================


router.get(

'/minhas',

autenticar,

async(req,res)=>{


try{


const motoristaId =
req.usuario.motorista_id;



const [despesas]=
await pool.query(

`

SELECT *

FROM despesas

WHERE motorista_id = ?

ORDER BY id DESC

`,

[motoristaId]

);



return res.json({

sucesso:true,

despesas

});



}catch(error){


return res.status(500).json({

sucesso:false,

erro:error.message

});


}


}

);
// =====================================================
// LISTAR DESPESAS - ADMIN
// =====================================================


router.get(
'/',
autenticar,
somenteAdmin,

async(req,res)=>{


try{


const {

inicio,

fim

}=req.query;



let sql = `

SELECT

d.id,

d.motorista_id,

u.nome AS motorista,

d.data,

d.categoria,

d.valor,

d.observacao,

d.comprovativo_url,

d.status,

d.created_at


FROM despesas d


INNER JOIN usuarios u

ON u.motorista_id = d.motorista_id


WHERE 1=1

`;



const valores = [];





if(inicio && fim){


sql += `

AND DATE(d.data)
BETWEEN ?
AND ?

`;



valores.push(
inicio,
fim
);


}


else if(inicio){


sql += `

AND DATE(d.data) >= ?

`;


valores.push(inicio);


}


else if(fim){


sql += `

AND DATE(d.data) <= ?

`;


valores.push(fim);


}





sql += `

ORDER BY d.data DESC, d.id DESC

`;





const [despesas] = await pool.query(

sql,

valores

);




return res.json({

sucesso:true,

despesas

});





}catch(error){


console.error(
'Erro listar despesas admin:',
error
);



return res.status(500).json({

sucesso:false,

erro:error.message

});


}


}

);







// ======================================================
// EDITAR DESPESA - ADMIN
// ======================================================


router.put(

'/:id',

autenticar,

somenteAdmin,

upload.single('comprovativo'),


async(req,res)=>{


try{


const {id}=req.params;



const {

data,

categoria,

valor,

observacao

}=req.body || {};





const valorNumerico =
Number(valor);




if(!categoria){

return res.status(400).json({

sucesso:false,

mensagem:
'Informe a categoria.'

});

}




const [existente] = await pool.query(

`

SELECT comprovativo_url

FROM despesas

WHERE id = ?

`,

[id]

);




if(existente.length===0){

return res.status(404).json({

sucesso:false,

mensagem:
'Despesa não encontrada.'

});

}




let comprovativo =
existente[0].comprovativo_url;





if(req.file){

comprovativo =
req.file.path;

}






await pool.query(

`

UPDATE despesas

SET

data=?,

categoria=?,

valor=?,

observacao=?,

comprovativo_url=?


WHERE id=?

`,

[

data || new Date(),

categoria.trim(),

valorNumerico,

observacao || null,

comprovativo,

id

]


);





return res.json({

sucesso:true,

mensagem:
'Despesa atualizada com sucesso.'

});




}catch(error){


console.error(
'Erro editar despesa:',
error
);



return res.status(500).json({

sucesso:false,

erro:error.message

});


}


}

);









// ======================================================
// EXCLUIR DESPESA - ADMIN
// ======================================================


router.delete(

'/:id',

autenticar,

somenteAdmin,


async(req,res)=>{


try{


const {id}=req.params;




const [resultado] = await pool.query(

`

DELETE FROM despesas

WHERE id=?

`,

[id]

);





if(resultado.affectedRows===0){


return res.status(404).json({

sucesso:false,

mensagem:
'Despesa não encontrada.'

});


}





return res.json({

sucesso:true,

mensagem:
'Despesa excluída.'

});





}catch(error){


console.error(
'Erro excluir despesa:',
error
);



return res.status(500).json({

sucesso:false,

erro:error.message

});


}


}

);








// ======================================================
// APROVAR DESPESA - ADMIN
// ======================================================


router.put(

'/aprovar/:id',

autenticar,

somenteAdmin,


async(req,res)=>{


try{


const {id}=req.params;



const [resultado] = await pool.query(

`

UPDATE despesas

SET status='aprovada'

WHERE id=?

`,

[id]

);





if(resultado.affectedRows===0){


return res.status(404).json({

sucesso:false,

mensagem:
'Despesa não encontrada.'

});


}







// procurar motorista dono da despesa


const [dados] = await pool.query(

`

SELECT

u.id AS usuario_id,

d.valor,

d.categoria


FROM despesas d


INNER JOIN usuarios u

ON u.motorista_id = d.motorista_id


WHERE d.id=?


`,

[id]

);






if(dados.length > 0){
  console.log(
    'Motorista a notificar:',
    dados[0].usuario_id
);



await notificarUsuario(

dados[0].usuario_id,

'Despesa aprovada ✅',

`A sua despesa de ${dados[0].categoria} no valor de ${dados[0].valor} Kz foi aprovada.`


);


}







return res.json({

sucesso:true,

mensagem:
'Despesa aprovada com sucesso.'

});





}catch(error){


console.error(
'Erro aprovar despesa:',
error
);



return res.status(500).json({

sucesso:false,

erro:error.message

});


}


}

);
// ======================================================
// REJEITAR DESPESA - ADMIN
// ======================================================


router.put(

'/rejeitar/:id',

autenticar,

somenteAdmin,


async(req,res)=>{


try{


const {id}=req.params;





const [resultado] = await pool.query(

`

UPDATE despesas

SET status='rejeitada'

WHERE id=?

`,

[id]

);





if(resultado.affectedRows===0){


return res.status(404).json({

sucesso:false,

mensagem:
'Despesa não encontrada.'

});


}






// Buscar motorista dono da despesa


const [dados] = await pool.query(

`

SELECT

u.id AS usuario_id,

d.valor,

d.categoria


FROM despesas d


INNER JOIN usuarios u

ON u.motorista_id = d.motorista_id


WHERE d.id=?


`,

[id]

);






// enviar somente para o motorista


if(dados.length > 0){
  console.log(
    'Motorista a notificar:',
    dados[0].usuario_id
);




await notificarUsuario(

dados[0].usuario_id,


'Despesa rejeitada ❌',


`A sua despesa de ${dados[0].categoria} no valor de ${dados[0].valor} Kz foi rejeitada.`


);


}






return res.json({

sucesso:true,

mensagem:
'Despesa rejeitada com sucesso.'

});






}catch(error){


console.error(

'Erro rejeitar despesa:',

error

);




return res.status(500).json({

sucesso:false,

erro:error.message

});


}


}

);







// ======================================================
// EXPORTAR ROTAS
// ======================================================


module.exports = router;