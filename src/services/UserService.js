import UserRepository from "../repositories/UserRepository.js";
import ReportRepository from "../repositories/ReportRepository.js";


export class UserNotFoundError extends Error {}

function publicProfile(user) {
    const source = typeof user.toJSON === "function" ? user.toJSON() : user;
    const karmaPoints = Number(source.karmaPoints ?? 0);
    if (!Number.isSafeInteger(karmaPoints) || karmaPoints < 0) throw new Error("Invalid stored karma");
    const { id, nombre, apellido, email, telefono, rol, distrito, status, createdAt, updatedAt } = source;
    return { id, nombre, apellido, email, telefono, rol, distrito, status, createdAt, updatedAt, karmaPoints };
}

class UserService {

    async getProfile(id) {

        const user = await UserRepository.findById(id);

        if (!user) {
            throw new UserNotFoundError("Usuario no encontrado.");
        }

        return publicProfile(user);

    }

    async getKarmaPoints(id) {
        const user = await UserRepository.findKarmaPoints(id);
        if (!user) throw new UserNotFoundError("Usuario no encontrado.");
        const points = Number(user.karmaPoints);
        if (!Number.isSafeInteger(points) || points < 0) throw new Error("Invalid stored karma");
        return points;
    }

    async updateProfile(id, data) {

        const user = await UserRepository.update(id, data);

        if (!user) {
            throw new UserNotFoundError("Usuario no encontrado.");
        }

        return publicProfile(user);

    }

    async getReports(id) {
        const reports = await ReportRepository.findByUserId(id);
        return reports.map((report) => ({ ...report, id: String(report.id), placeId: Number(report.placeId) }));
    }


}

export default new UserService();
