import service from "../services/AdminUserService.js";
import { AdministrationError } from "../domain/administration.js";

export function createAdminUserController(users = service) {
    const handle = (action) => async (req, res) => {
        try {
            res.json(await action(req));
        } catch (error) {
            const known = error instanceof AdministrationError || error.code === "SESSION_INVALID";
            res.status(known ? error.status : 503).json({
                code: known ? error.code : "SERVICE_UNAVAILABLE",
                message: known
                    ? error.message
                    : "No se pudo cargar la información de usuarios. Inténtalo de nuevo."
            });
        }
    };
    return {
        list: handle((req) => users.list(req.user, req.query)),
        detail: handle(async (req) => ({
            data: await users.detail(req.user, req.params.id, req.query)
        })),
        history: handle((req) => users.history(req.user, req.params.id, req.query)),
        suspend: handle(async (req) => ({
            data: await users.transition(req.user, req.params.id, req.query, req.body, "SUSPEND")
        })),
        reactivate: handle(async (req) => ({
            data: await users.transition(req.user, req.params.id, req.query, req.body, "REACTIVATE")
        }))
    };
}

export default createAdminUserController();
