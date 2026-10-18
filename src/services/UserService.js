import UserRepository from "../repositories/UserRepository.js";
import ReportRepository from "../repositories/ReportRepository.js";
import { karmaPointsPerReport } from "../config/environment.js";

class UserService {

    async getProfile(id) {

        const user = await UserRepository.findById(id);

        if (!user) {
            throw new Error("Usuario no encontrado.");
        }

        return user;

    }

    async getKarmaPoints(id) {
        const user = await UserRepository.findKarmaPoints(id);
        if (!user) throw new Error("Usuario no encontrado.");
        return Number(user.karmaPoints);
    }

    async updateProfile(id, data) {

        const user = await UserRepository.update(id, data);

        if (!user) {
            throw new Error("Usuario no encontrado.");
        }

        return user;

    }

    async getReports(id) {
        const reports = await ReportRepository.findByUserId(id);
        return reports.map((report) => ({ ...report, id: Number(report.id), placeId: Number(report.placeId) }));
    }

    async addKarmaPoints(id, points) {
        if (!Number.isSafeInteger(points) || points < 0) {
            throw new Error("Los puntos de karma no son válidos.");
        }
        const karmaPoints = await UserRepository.addKarmaPoints(id, points);
        if (karmaPoints === null) throw new Error("Usuario no encontrado.");
        return karmaPoints;
    }

    async awardReportKarma(id) {
        return this.addKarmaPoints(id, karmaPointsPerReport());
    }

}

export default new UserService();
