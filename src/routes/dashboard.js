const express = require('express');
const pool = require('../db');

const {
    autenticar,
    somenteAdmin
} = require('../middleware/auth');

const router = express.Router();


// ======================================================
// DASHBOARD / RELATÓRIO
// ======================================================

router.get(
'/',
autenticar,
somenteAdmin,
async (req,res)=>{

try {


const {
tipo='diario',
data,
inicio,
fim,
motorista_id
}=req.query;



// ======================================================
// VALIDAR TIPO
// ======================================================

const tiposValidos=[
'diario',
'semanal',
'mensal',
'anual'
];


if(!tiposValidos.includes(tipo)){

return res.status(400).json({

sucesso:false,

mensagem:
'Tipo inválido.'

});

}



// ======================================================
// VALIDAR DATA
// ======================================================


if(!data && !inicio && !fim){

return res.status(400).json({

sucesso:false,

mensagem:
'Informe uma data.'

});

}



if((inicio&&!fim)||(!inicio&&fim)){

return res.status(400).json({

sucesso:false,

mensagem:
'Informe início e fim.'

});

}



// ======================================================
// DEFINIR PERÍODO
// ======================================================


let dataInicio;
let dataFim;



if(inicio && fim){

dataInicio=inicio;
dataFim=fim;

}

else{


if(tipo==='diario'){

dataInicio=data;
dataFim=data;

}


else if(tipo==='mensal'){


const [ano,mes]=data.split('-')
.map(Number);


dataInicio =
`${ano}-${String(mes).padStart(2,'0')}-01`;


const ultimo=
new Date(
ano,
mes,
0
);


dataFim=
formatarData(ultimo);


}


else if(tipo==='anual'){


const ano=
Number(
data.split('-')[0]
);


dataInicio=
`${ano}-01-01`;

dataFim=
`${ano}-12-31`;

}


else if(tipo==='semanal'){


const partes=
data.split('-')
.map(Number);


const selecionada=
new Date(
partes[0],
partes[1]-1,
partes[2]
);


const inicioSemana=
new Date(selecionada);


inicioSemana.setDate(
selecionada.getDate()
-
(selecionada.getDay()===0
?6
:selecionada.getDay()-1)
);


const fimSemana=
new Date(inicioSemana);


fimSemana.setDate(
inicioSemana.getDate()+6
);


dataInicio=
formatarData(inicioSemana);


dataFim=
formatarData(fimSemana);


}



}




console.log(
'DASHBOARD',
dataInicio,
dataFim,
motorista_id || 'TODOS'
);




// ======================================================
// FILTROS
// ======================================================


let filtroCorrida='';

let filtroDespesa='';


const parametrosCorrida=[
dataInicio,
dataFim
];


const parametrosDespesa=[
dataInicio,
dataFim
];



if(motorista_id){


filtroCorrida=
' AND motorista_id=?';


filtroDespesa=
' AND motorista_id=?';


parametrosCorrida.push(
Number(motorista_id)
);


parametrosDespesa.push(
Number(motorista_id)
);


}



// ======================================================
// MOTORISTAS TOTAL
// ======================================================


const [[motoristasTotais]]
=
await pool.query(
`
SELECT COUNT(*) total
FROM motoristas
WHERE ativo=1
`
);



// ======================================================
// CORRIDAS
// ======================================================


const [[arrecadacao]]
=
await pool.query(

`
SELECT

COUNT(*) total_corridas,

COALESCE(
    SUM(valor_total),
    0
) AS receita_hiace


FROM corridas


WHERE DATE(data_corrida)
BETWEEN ? AND ?


${filtroCorrida}

`,

parametrosCorrida

);





const totalCorridas=
Number(
arrecadacao.total_corridas||0
);



const receitaTotal=
Number(
arrecadacao.receita||0
);




// ======================================================
// DESPESAS
// ======================================================


const [[despesas]]
=
await pool.query(

`
SELECT


COUNT(*) total_despesas,


COALESCE(
SUM(
CASE
WHEN status='aprovada'
THEN valor
ELSE 0
END
),
0
) despesas


FROM despesas


WHERE DATE(data)
BETWEEN ? AND ?


${filtroDespesa}

`,

parametrosDespesa

);



const despesasTotal=
Number(
despesas.despesas||0
);



const saldoGeral=
receitaTotal-
despesasTotal;



// ======================================================
// HIACE GERAL
// ======================================================


let filtroHiace='';


const parametrosHiace=[

dataInicio,

dataFim

];



if(motorista_id){


filtroHiace=
' AND motorista_id=?';


parametrosHiace.push(
Number(motorista_id)
);


}



const [[hiaceTotal]]
=
await pool.query(

`
SELECT

COUNT(*) AS viagens,

COALESCE(
    SUM(valor_total),
    0
) AS receita_hiace,

COALESCE(
    SUM(total_passageiros),
    0
) AS passageiros


FROM viagens_hiace


WHERE DATE(data_inicio)
BETWEEN ? AND ?


${filtroHiace}

`,

parametrosHiace

);


const viagensHiace=
Number(
hiaceTotal.viagens||0
);


const receitaHiace=
Number(
hiaceTotal.receita||0
);


const passageirosHiace=
Number(
hiaceTotal.passageiros||0
);
// ======================================================
// LISTA MOTORISTAS
// ======================================================


let queryMotoristas = `

SELECT

id,
nome,
telefone,
documento,
email,
ativo


FROM motoristas


WHERE ativo=1

`;



const parametrosMotoristas=[];



if(motorista_id){


queryMotoristas += `

AND id=?

`;


parametrosMotoristas.push(
Number(motorista_id)
);


}



queryMotoristas += `

ORDER BY nome ASC

`;



const [motoristas]
=
await pool.query(
queryMotoristas,
parametrosMotoristas
);



const dadosMotoristas=[];



// ======================================================
// DADOS POR MOTORISTA
// ======================================================


for(const motorista of motoristas){



// ==============================
// CORRIDAS MOTORISTA
// ==============================


const [[corridasMotorista]]
=
await pool.query(

`
SELECT

COUNT(*) total_corridas,

COALESCE(
    SUM(valor_total),
    0
) AS receita


FROM corridas


WHERE motorista_id=?


AND DATE(data_corrida)
BETWEEN ? AND ?

`,

[

motorista.id,

dataInicio,

dataFim

]

);





// ==============================
// DESPESAS MOTORISTA
// ==============================


const [[despesasMotorista]]
=
await pool.query(

`
SELECT


COALESCE(

SUM(

CASE

WHEN status='aprovada'

THEN valor

ELSE 0

END

),

0

) despesas


FROM despesas


WHERE motorista_id=?


AND DATE(data)

BETWEEN ? AND ?

`,

[

motorista.id,

dataInicio,

dataFim

]

);






// ==============================
// HIACE MOTORISTA
// ==============================

const [[hiaceMotorista]] =
await pool.query(
`
SELECT

COUNT(*) AS viagens,

COALESCE(
    SUM(valor_total),
    0
) AS receita,

COALESCE(
    SUM(total_passageiros),
    0
) AS passageiros


FROM viagens_hiace


WHERE motorista_id = ?

AND DATE(data_inicio)
BETWEEN ? AND ?

`,
[
 motorista.id,
 dataInicio,
 dataFim
]
);


const totalCorridasMotorista =
Number(
corridasMotorista.total_corridas || 0
);



const receitaMotorista =
Number(
corridasMotorista.receita || 0
);



const despesasMotoristaTotal =
Number(
despesasMotorista.despesas || 0
);



const saldoMotorista =
receitaMotorista -
despesasMotoristaTotal;





dadosMotoristas.push({



id:
motorista.id,


nome:
motorista.nome,


telefone:
motorista.telefone,


documento:
motorista.documento,


email:
motorista.email,


ativo:
motorista.ativo,




// CORRIDAS

total_corridas:
totalCorridasMotorista,


receita:
receitaMotorista.toFixed(2),



// DESPESAS

despesas:
despesasMotoristaTotal.toFixed(2),



saldo:
saldoMotorista.toFixed(2),



// ======================
// HIACE
// ======================


viagens_hiace:
Number(
hiaceMotorista.viagens || 0
),



receita_hiace:
Number(
hiaceMotorista.receita || 0
)
.toFixed(2),



passageiros_hiace:
Number(
hiaceMotorista.passageiros || 0
)



});



}



// ======================================================
// GRÁFICO
// ======================================================


let grafico=[];



const [graficoDados]
=
await pool.query(

`

SELECT


DATE_FORMAT(
data_corrida,
'%Y-%m-%d'
) periodo,


COALESCE(
SUM(valor_total),
0
) AS receita


FROM corridas


WHERE DATE(data_corrida)

BETWEEN ? AND ?



GROUP BY periodo


ORDER BY periodo ASC



`,

[

dataInicio,

dataFim

]

);




for(const item of graficoDados){


grafico.push({

periodo:
item.periodo,


receita:
Number(
item.receita || 0
),


despesas:
0


});


}
// ======================================================
// RESPOSTA FINAL
// ======================================================


return res.json({

sucesso:true,


tipo,


data:
data || null,


periodo:{

inicio:dataInicio,

fim:dataFim

},


motorista_id:

motorista_id
?
Number(motorista_id)
:
null,



// ==================================================
// TOTAIS
// ==================================================


totais:{



motoristas:
Number(
motoristasTotais.total || 0
),



corridas:
totalCorridas,



corridas_hoje:
totalCorridas,



// RECEITAS CORRIDAS

receita:
receitaTotal.toFixed(2),


total_arrecadado:
receitaTotal.toFixed(2),



// DESPESAS

despesas:
despesasTotal.toFixed(2),



saldo:
saldoGeral.toFixed(2),


saldo_geral:
saldoGeral.toFixed(2),




// ================================
// HIACE
// ================================


viagens_hiace:
viagensHiace,


receita_hiace:
receitaHiace.toFixed(2),


passageiros_hiace:
passageirosHiace




},




// MOTORISTAS

motoristas:
dadosMotoristas,



// GRÁFICO

grafico


});





}
catch(error){


console.error(
'ERRO DASHBOARD:',
error
);



return res.status(500).json({

sucesso:false,

mensagem:
'Erro ao carregar relatório.',

erro:
error.message

});


}


}

);




// ======================================================
// FUNÇÃO DATA
// ======================================================


function formatarData(data){


const ano =
data.getFullYear();



const mes =
String(
data.getMonth()+1
)
.padStart(2,'0');



const dia =
String(
data.getDate()
)
.padStart(2,'0');



return `${ano}-${mes}-${dia}`;


}




module.exports = router;