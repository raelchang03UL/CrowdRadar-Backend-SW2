import User from "../models/User.js";
import sequelize from "../config/database.js";
import recoveryRepository from "./PasswordRecoveryRepository.js";

class UserRepository {

    async invalidatePasswordResetTokens(id, transaction) {
        await recoveryRepository.invalidateForUser(id, transaction);
    }

    async create(data) {
        return await User.create(data);
    }

    async findById(id) {
        return await User.findByPk(id, {
            attributes: {
                exclude: ["passwordHash", "sessionVersion"]
            }
        });
    }

    async findKarmaPoints(id) {
        return User.findByPk(id, {
            attributes: ["id", "karmaPoints"],
            raw: true
        });
    }

    async addKarmaPoints(id, points, transaction) {
        const user = await User.findByPk(id, {
            transaction,
            lock: transaction?.LOCK.UPDATE
        });
        if (!user) return null;
        user.karmaPoints = Number(user.karmaPoints) + points;
        await user.save({ transaction });
        return Number(user.karmaPoints);
    }

    async findByEmail(email) {
        return await User.findOne({
            where: {
                email
            }
        });
    }

    async findSessionById(id) {
        return User.findByPk(id, { attributes: ["id", "rol", "status", "sessionVersion"], raw: true });
    }

    async withLockedUser(id, operation) {
        return sequelize.transaction(async (transaction) => {
            const user = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
            return operation(user, transaction);
        });
    }

    async update(id, data) {

        const user = await User.findByPk(id);

        if (!user) {
            return null;
        }

        await user.update(data);

        return await User.findByPk(id, {
            attributes: {
                exclude: ["passwordHash", "sessionVersion"]
            }
        });

    }

}

export default new UserRepository();
