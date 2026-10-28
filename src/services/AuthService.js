import bcrypt from "bcrypt";
import UserRepository from "../repositories/UserRepository.js";
import jwt from "../utils/jwt.js";
import { validPassword, AuthError, invalidSession } from "../utils/passwordPolicy.js";

class AuthService {

    async register(userData) {

        if (!validPassword(userData.password)) {
            throw new AuthError(400, "PASSWORD_VALIDATION", "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes.");
        }

        const existingUser = await UserRepository.findByEmail(userData.email);

        if (existingUser) {
            throw new AuthError(400, "EMAIL_EXISTS", "El correo ya está registrado.");
        }

        const passwordHash = await bcrypt.hash(userData.password, 10);

        const { password, ...publicData } = userData;
        const newUser = await UserRepository.create({
            ...publicData,
            passwordHash,
            rol: "USUARIO",
            status: "ACTIVO"
        });

        return {
            id: newUser.id,
            nombre: newUser.nombre,
            apellido: newUser.apellido,
            email: newUser.email
        };

    }

    async login(email, password) {

        if (!validPassword(password, { minimum: 1 })) {
            throw new AuthError(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
        }

        const user = await UserRepository.findByEmail(email);

        if (!user) {
            throw new AuthError(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!passwordMatches) {
            throw new AuthError(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
        }

        // Informar el estado solo después de comprobar la contraseña.
        if (user.status === "SUSPENDIDO") {
            throw new AuthError(403, "ACCOUNT_SUSPENDED", "Tu cuenta está suspendida. Un administrador debe reactivarla para que puedas volver a ingresar.");
        }
        if (user.status !== "ACTIVO") {
            throw new AuthError(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
        }

        const token = jwt.generateToken(user);

        return {
            token,
            user: {
                id: user.id,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                rol: user.rol
            }
        };

    }

    async changePassword(id, sessionVersion, { currentPassword, newPassword, confirmPassword }) {
        if (!validPassword(currentPassword, { minimum: 1 }) || !validPassword(newPassword)) {
            throw new AuthError(400, "PASSWORD_VALIDATION", "La contraseña nueva debe tener al menos 8 caracteres y no superar 72 bytes.");
        }
        if (newPassword !== confirmPassword) {
            throw new AuthError(400, "PASSWORD_MISMATCH", "La confirmación no coincide con la contraseña nueva.");
        }
        return UserRepository.withLockedUser(id, async (user, transaction) => {
            if (!user || user.status !== "ACTIVO" || user.sessionVersion !== sessionVersion) throw invalidSession();
            if (!await bcrypt.compare(currentPassword, user.passwordHash)) {
                throw new AuthError(403, "CURRENT_PASSWORD_INVALID", "La contraseña actual no es correcta.");
            }
            if (await bcrypt.compare(newPassword, user.passwordHash)) {
                throw new AuthError(400, "PASSWORD_REUSED", "Elige una contraseña diferente de la actual.");
            }
            if (user.sessionVersion >= 2147483647) throw new Error("Session version exhausted");
            const passwordHash = await bcrypt.hash(newPassword, 10);
            await user.update({ passwordHash, sessionVersion: user.sessionVersion + 1 }, { transaction });
            await UserRepository.invalidatePasswordResetTokens(user.id, transaction);
        });
    }

}

export default new AuthService();
