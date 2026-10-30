import { requireAdministrator } from "../domain/administration.js";

// authMiddleware debe ejecutarse antes: el rol procede de PostgreSQL, no del cliente.
export default function adminMiddleware(req, res, next) {
    try {
        requireAdministrator(req.user);
        return next();
    } catch (error) {
        return res.status(error.status).json({ code: error.code, message: error.message });
    }
}
