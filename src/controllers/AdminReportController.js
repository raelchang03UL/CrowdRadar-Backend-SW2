import service from '../services/AdminReportService.js';
import {AdministrationError} from '../domain/administration.js';
const handle=action=>async(req,res)=>{
    try{res.json(await action(req));}
    catch(error){
        const known=error instanceof AdministrationError || error.code==='SESSION_INVALID';
        res.status(known?error.status:503).json({code:known?error.code:'SERVICE_UNAVAILABLE',message:known?error.message:'No se pudo completar la revisión. Actualiza la información antes de intentarlo otra vez.'});
    }
};
export default {
    list:handle(req=>service.list(req.user,req.query)),
    detail:handle(req=>service.detail(req.user,req.params.id,req.query)),
    decide:handle(req=>service.decide(req.user,req.params.id,req.query,req.body))
};
