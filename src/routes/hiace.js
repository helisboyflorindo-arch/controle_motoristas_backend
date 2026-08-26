const express = require('express');
const pool = require('../db');

const {
    autenticar
} = require('../middleware/auth');


const router = express.Router();


// ======================================================
// INICIAR VIAGEM HIACE
// ======================================================

router.post(
    '/iniciar',
    autenticar,
    async (req,res)=>{

        try {


            const {
                rota
            } = req.body;


        const motorista_id =
req.usuario.motorista_id;

console.log("USUARIO JWT:", req.usuario);
console.log("MOTORISTA ID:", motorista_id);



            if(!rota){

                return res.status(400).json({

                    sucesso:false,

                    mensagem:
                    'Informe a rota.'

                });

            }
            const origem_registo = "APP";

            // criar id offline
const id_offline =
'HIACE-' + Date.now();

              const [resultado] = await pool.query(

`
INSERT INTO viagens_hiace
(
motorista_id,
rota,
data_inicio,
id_offline,
origem_registo
)

VALUES
(
?,
?,
NOW(),
?,
?
)
`,

[
motorista_id,
rota,
id_offline,
origem_registo
]

);

console.log("VIAGEM CRIADA:", resultado.insertId);


            res.json({

                sucesso:true,

                mensagem:
                'Viagem iniciada.',


                viagem_id:
                resultado.insertId

            });



        }catch(error){

            console.log(error);


            res.status(500).json({

                sucesso:false,

                mensagem:
                'Erro ao iniciar viagem.'

            });

        }

    }
);




// ======================================================
// REGISTAR PAGAMENTO
// ======================================================

router.post(
    '/pagamento',
    autenticar,
    async(req,res)=>{


        try{


            const {

                viagem_id,

                valor

            } = req.body;



            await pool.query(

                `

                INSERT INTO pagamentos_hiace

                (
                    viagem_id,
                    valor
                )

                VALUES

                (?,?)

                `,

                [
                    viagem_id,
                    valor
                ]

            );



            await pool.query(

                `

                UPDATE viagens_hiace

                SET

                total_passageiros =
                total_passageiros + 1,


                valor_total =
                valor_total + ?

                WHERE id = ?

                `,


                [
                    valor,
                    viagem_id
                ]

            );



            res.json({

                sucesso:true,

                mensagem:
                'Pagamento registado.'

            });



        }catch(error){


            console.log(error);


            res.status(500).json({

                sucesso:false,

                mensagem:
                'Erro ao registar pagamento.'

            });


        }


    }
);




// ======================================================
// VIAGEM ACTUAL
// ======================================================


router.get(
    '/actual',
    autenticar,
    async(req,res)=>{


        try{


            const motorista_id =
    req.usuario.motorista_id;


            const [[viagem]] =
            await pool.query(

                `

                SELECT *

                FROM viagens_hiace

                WHERE motorista_id = ?

                AND status='activa'

                ORDER BY id DESC

                LIMIT 1

                `,

                [
                    motorista_id
                ]

            );



            res.json({

                sucesso:true,

                viagem:

                viagem || null


            });



        }catch(error){


            res.status(500).json({

                sucesso:false,

                mensagem:
                'Erro.'

            });


        }


    }

);




// ======================================================
// FECHAR VIAGEM
// ======================================================
router.put(
'/fechar/:id',
autenticar,
async(req,res)=>{

try{


const [[viagem]] = await pool.query(

`
SELECT *
FROM viagens_hiace
WHERE id=?
`,
[
req.params.id
]

);



if(!viagem){

return res.status(404).json({

sucesso:false,

mensagem:'Viagem não encontrada.'

});

}




await pool.query(

`
UPDATE viagens_hiace

SET

status='finalizada',

data_fim=NOW()

WHERE id=?

`,

[
req.params.id
]

);



res.json({

sucesso:true,

mensagem:'Viagem fechada.',

viagem:{

id:viagem.id,

rota:viagem.rota,

ganho:viagem.valor_total

}

});



}catch(error){

console.log(error);


res.status(500).json({

sucesso:false,

mensagem:'Erro ao fechar viagem.'

});


}


}

);
// ======================================================
// LISTAR VIAGENS HIACE - ADMIN
// ======================================================

router.get(
    '/admin',
    autenticar,
    async(req,res)=>{

        try{


            const [viagens] =
            await pool.query(

                `
                SELECT

                    v.id,

                    v.rota,

                    v.data_inicio,

                    v.data_fim,

                    v.status,

                    v.total_passageiros,

                    v.valor_total,

                    m.nome AS motorista


                FROM viagens_hiace v


                INNER JOIN motoristas m

                ON m.id = v.motorista_id


                ORDER BY v.id DESC

                `

            );



            res.json({

                sucesso:true,

                viagens: viagens

            });



        }catch(error){


            console.log(error);


            res.status(500).json({

                sucesso:false,

                mensagem:
                'Erro ao buscar viagens Hiace'

            });


        }


    }
);


// ======================================================
// HISTÓRICO DO MOTORISTA
// ======================================================
router.get(
'/historico',
autenticar,
async(req,res)=>{

try{


const motorista_id =
req.usuario.motorista_id;



const [viagens] =
await pool.query(

`
SELECT

id,
rota,
data_inicio,
data_fim,
total_passageiros,
valor_total,
status

FROM viagens_hiace

WHERE motorista_id=?

AND status='finalizada'

ORDER BY id DESC

`,
[
motorista_id
]

);



const [despesas] =
await pool.query(

`
SELECT

id,
categoria,
valor,
observacao,
data

FROM despesas

WHERE motorista_id=?

ORDER BY id DESC

`,
[
motorista_id
]

);



res.json({

sucesso:true,

viagens,

despesas


});



}catch(error){

console.log(error);


res.status(500).json({

sucesso:false

});


}


});

module.exports = router;