import UserService, { UserNotFoundError } from "../services/UserService.js";

class UserController {

    async getKarma(req, res) {
        try {
            const karmaPoints = await UserService.getKarmaPoints(req.user.id);
            return res.status(200).json({ data: { karmaPoints } });
        } catch (error) {
            return res.status(error instanceof UserNotFoundError ? 404 : 503).json({ message: error instanceof UserNotFoundError ? "Usuario no encontrado." : "No se pudo cargar tu karma. Inténtalo de nuevo." });
        }
    }

    async getProfile(req, res) {

        try {

            const user = await UserService.getProfile(req.user.id);

            return res.status(200).json({
                data: user
            });

        } catch (error) {

            return res.status(error instanceof UserNotFoundError ? 404 : 503).json({ message: error instanceof UserNotFoundError ? "Usuario no encontrado." : "No se pudo cargar tu perfil. Inténtalo de nuevo." });

        }

    }

    async updateProfile(req, res) {

        try {

            const user = await UserService.updateProfile(
                req.user.id,
                req.body
            );

            return res.status(200).json({
                message: "Perfil actualizado correctamente.",
                data: user
            });

        } catch (error) {

            return res.status(error instanceof UserNotFoundError ? 404 : 503).json({ message: error instanceof UserNotFoundError ? "Usuario no encontrado." : "No se pudo guardar tu perfil. Inténtalo de nuevo." });

        }

    }

    async getReports(req, res) {
        try {
            return res.status(200).json({
                data: await UserService.getReports(req.user.id)
            });
        } catch {
            return res.status(503).json({
                message: "No se pudo cargar el historial de reportes. Inténtalo de nuevo."
            });
        }
    }

}

export default new UserController();
