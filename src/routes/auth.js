const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();


// ======================================================
// LOGIN
// ======================================================

router.post('/login', async (req, res) => {

    try {

        const {
            email,
            senha
        } = req.body;


        if(!email || !senha){

            return res.status(400).json({

                sucesso:false,

                mensagem:
                'Email e senha são obrigatórios.'

            });

        }



        const [usuarios] = await pool.query(

        `
        SELECT

            id,
            nome,
            telefone,
            email,
            senha,
            tipo,
            motorista_id,
            ativo,
            created_at

        FROM usuarios

        WHERE email = ?

        LIMIT 1

        `,

        [
            email
        ]

        );



        if(usuarios.length === 0){

            return res.status(401).json({

                sucesso:false,

                mensagem:
                'Email ou senha incorretos.'

            });

        }



        const usuario = usuarios[0];



        if(!usuario.ativo){

            return res.status(403).json({

                sucesso:false,

                mensagem:
                'Usuário desativado.'

            });

        }



        const senhaCorreta =
        await bcrypt.compare(

            senha,

            usuario.senha

        );



        if(!senhaCorreta){

            return res.status(401).json({

                sucesso:false,

                mensagem:
                'Email ou senha incorretos.'

            });

        }



        const token = jwt.sign(

        {

            id: usuario.id,

            nome: usuario.nome,

            email: usuario.email,

            telefone: usuario.telefone,

            tipo: usuario.tipo,

            motorista_id:
            usuario.motorista_id

        },

        process.env.JWT_SECRET,

        {

            expiresIn:'7d'

        }

        );



        delete usuario.senha;



        return res.json({

            sucesso:true,

            mensagem:
            'Login realizado com sucesso.',

            token,

            usuario

        });



    }catch(error){


        console.error(
            'ERRO LOGIN:',
            error
        );


        return res.status(500).json({

            sucesso:false,

            mensagem:
            'Erro interno do servidor.',

            erro:error.message

        });


    }


});




// ======================================================
// CADASTRO MOTORISTA
// ======================================================


router.post('/register', async(req,res)=>{


let conexao;


try{


const {

nome,
telefone,
documento,
email,
senha

}=req.body;



if(
!nome ||
!telefone ||
!documento ||
!email ||
!senha
){


return res.status(400).json({

sucesso:false,

mensagem:
'Todos os campos são obrigatórios.'

});


}




conexao =
await pool.getConnection();



const [emailExistente] =
await conexao.query(

`
SELECT id
FROM usuarios
WHERE email = ?
LIMIT 1
`,

[email]

);



if(emailExistente.length){

return res.status(409).json({

sucesso:false,

mensagem:
'Email já cadastrado.'

});

}




const [documentoExistente] =
await conexao.query(

`
SELECT id
FROM motoristas
WHERE documento = ?
LIMIT 1
`,

[documento]

);



if(documentoExistente.length){

return res.status(409).json({

sucesso:false,

mensagem:
'Documento já cadastrado.'

});

}





const senhaHash =
await bcrypt.hash(
senha,
10
);




await conexao.beginTransaction();




const [motorista] =
await conexao.query(

`
INSERT INTO motoristas

(
nome,
telefone,
documento,
email,
ativo
)

VALUES

(
?,
?,
?,
?,
1
)

`,

[
nome,
telefone,
documento,
email
]

);



const motoristaId =
motorista.insertId;





const [usuario] =
await conexao.query(

`
INSERT INTO usuarios

(
nome,
telefone,
email,
senha,
tipo,
motorista_id,
ativo
)

VALUES

(
?,
?,
?,
?,
'motorista',
?,
1
)

`,

[
nome,
telefone,
email,
senhaHash,
motoristaId
]

);




await conexao.commit();



return res.status(201).json({

sucesso:true,

mensagem:
'Conta criada com sucesso.',

usuario_id:
usuario.insertId,

motorista_id:
motoristaId


});



}catch(error){



if(conexao){

await conexao.rollback();

}



console.error(
'ERRO CADASTRO:',
error
);



return res.status(500).json({

sucesso:false,

mensagem:
'Erro ao criar conta.',

erro:error.message

});



}finally{


if(conexao){

conexao.release();

}


}



});

// ======================================================
// ALTERAR SENHA
// ======================================================

router.put('/alterar-senha', autenticar, async (req,res)=>{

try{

const {
senha_atual,
nova_senha
}=req.body;


const usuarioId =
req.usuario.id;


if(!senha_atual || !nova_senha){

return res.status(400).json({

sucesso:false,

mensagem:
'Informe as senhas.'

});

}



const [usuarios] =
await pool.query(

`
SELECT senha
FROM usuarios
WHERE id = ?

`,

[
usuarioId
]

);



if(!usuarios.length){

return res.status(404).json({

sucesso:false,

mensagem:
'Usuário não encontrado.'

});

}



const correto =
await bcrypt.compare(

senha_atual,

usuarios[0].senha

);



if(!correto){

return res.status(401).json({

sucesso:false,

mensagem:
'Senha atual incorrecta.'

});

}



const novaHash =
await bcrypt.hash(

nova_senha,

10

);



await pool.query(

`
UPDATE usuarios
SET senha = ?
WHERE id = ?

`,

[
novaHash,
usuarioId
]

);



return res.json({

sucesso:true,

mensagem:
'Senha alterada.'

});


}catch(error){


return res.status(500).json({

sucesso:false,

erro:error.message

});


}


});





// ======================================================
// PERFIL
// ======================================================


router.get('/perfil', autenticar, async(req,res)=>{


try{


const usuarioId =
req.usuario.id;



const [usuarios] =
await pool.query(

`
SELECT

id,
nome,
telefone,
email,
tipo,
motorista_id,
ativo

FROM usuarios

WHERE id = ?

`,

[
usuarioId
]

);



return res.json({

sucesso:true,

usuario:
usuarios[0]

});



}catch(error){


return res.status(500).json({

sucesso:false,

erro:error.message

});


}


});





// ======================================================
// ACTUALIZAR PERFIL
// ======================================================


router.put('/perfil', autenticar, async(req,res)=>{


try{


const {
nome
}=req.body;



await pool.query(

`
UPDATE usuarios

SET nome = ?

WHERE id = ?

`,

[
nome,
req.usuario.id
]

);



return res.json({

sucesso:true,

mensagem:
'Perfil actualizado.'

});


}catch(error){


return res.status(500).json({

sucesso:false,

erro:error.message

});


}


});





// ======================================================
// PREFERÊNCIAS
// ======================================================


router.put('/preferencias', autenticar, async(req,res)=>{


try{


const {
notificacoes,
modo_escuro

}=req.body;



await pool.query(

`
UPDATE usuarios

SET

notificacoes = ?,

modo_escuro = ?

WHERE id = ?

`,

[

notificacoes ? 1 : 0,

modo_escuro ? 1 : 0,

req.usuario.id

]

);



return res.json({

sucesso:true,

mensagem:
'Preferências actualizadas.'

});


}catch(error){


return res.status(500).json({

sucesso:false,

erro:error.message

});


}


});





// ======================================================
// GUARDAR FCM TOKEN
// MOTORISTA / ADMIN
// ======================================================


router.post('/fcm-token', autenticar, async(req,res)=>{


try{


const usuarioId =
req.usuario.id;


const {

fcm_token,

dispositivo,

plataforma

}=req.body;



if(!fcm_token){


return res.status(400).json({

sucesso:false,

mensagem:
'FCM Token obrigatório.'

});


}





await pool.query(

`

INSERT INTO dispositivos

(
usuario_id,
fcm_token,
dispositivo,
plataforma,
ativo

)

VALUES

(
?,
?,
?,
?,
1

)

ON DUPLICATE KEY UPDATE


ativo = 1,

dispositivo = VALUES(dispositivo),

plataforma = VALUES(plataforma),

ultimo_acesso = CURRENT_TIMESTAMP


`

,

[

usuarioId,

fcm_token,

dispositivo || 'Android',

plataforma || 'Android'


]

);





console.log(
'FCM guardado:',
usuarioId
);





return res.json({

sucesso:true,

mensagem:
'FCM registado com sucesso.'

});




}catch(error){


console.error(
'Erro FCM:',
error
);



return res.status(500).json({

sucesso:false,

mensagem:
'Erro ao guardar FCM.',

erro:error.message

});


}


});
// ======================================================
// EXPORTAR ROUTER
// ======================================================

module.exports = router;