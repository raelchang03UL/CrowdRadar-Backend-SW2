import UserRepository from "../repositories/UserRepository.js";
import ReportRepository from "../repositories/ReportRepository.js";

class UserService {

    async getProfile(id) {

        const user = await UserRepository.findById(id);

        if (!user) {
            throw new Error("Usuario no encontrado.");
        }

        return user;

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
        return reports.map((report) => ({
            ...report,
            id: Number(report.id),
            placeId: Number(report.placeId)
        }));
    }

}

export default new UserService();