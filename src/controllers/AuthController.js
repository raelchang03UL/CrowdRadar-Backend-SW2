import AuthService from "../services/AuthService.js";
import { AuthError } from "../utils/passwordPolicy.js";

class AuthController {

    async changePassword(req, res) {
        try {
            await AuthService.changePassword(req.user.id, req.user.sessionVersion, req.body);
            return res.status(200).json({ message: "Contraseña actualizada. Inicia sesión nuevamente." });
        } catch (error) {
            if (error instanceof AuthError) return res.status(error.status).json({ message: error.message, code: error.code });
            return res.status(503).json({ message: "No se pudo actualizar la contraseña. Inténtalo de nuevo.", code: "SERVICE_UNAVAILABLE" });
        }
    }

    async register(req, res) {

        try {

            const user = await AuthService.register(req.body);

            return res.status(201).json({
                message: "Usuario registrado correctamente.",
                data: user
            });

        } catch (error) {
            if (error instanceof AuthError) return res.status(error.status).json({ message: error.message, code: error.code });
            return res.status(503).json({ message: "No se pudo crear la cuenta. Inténtalo de nuevo.", code: "SERVICE_UNAVAILABLE" });
        }

    }

    async login(req, res) {

        try {

            const { email, password } = req.body;

            const response = await AuthService.login(email, password);

            return res.status(200).json({
                message: "Inicio de sesión exitoso.",
                data: response
            });

        } catch (error) {
            if (error instanceof AuthError) return res.status(error.status).json({ message: error.message, code: error.code });
            return res.status(503).json({ message: "No se pudo iniciar sesión. Inténtalo de nuevo.", code: "SERVICE_UNAVAILABLE" });
        }

    }

}

export default new AuthController();
