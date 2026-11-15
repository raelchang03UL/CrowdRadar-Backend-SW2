import test from "node:test";
import assert from "node:assert/strict";
import sequelize from "../src/config/database.js";
import favorites from "../src/repositories/FavoriteRepository.js";
import push from "../src/repositories/PushNotificationRepository.js";
import recovery from "../src/repositories/PasswordRecoveryRepository.js";
import { PushNotificationService } from "../src/services/PushNotificationService.js";

test("favorito, snapshot, reconciliación y claim reutilizan la conexión de su transacción", async context => {
    const original = { transaction: sequelize.transaction, query: sequelize.query };
    context.after(() => Object.assign(sequelize, original));
    let currentTransaction;
    let transactions = 0;
    let snapshotReads = 0;
    sequelize.transaction = async operation => {
        assert.equal(currentTransaction, undefined, "No adquirir otra conexión dentro de la transacción");
        const transaction = {};
        currentTransaction = transaction;
        transactions++;
        try { return await operation(transaction); }
        finally { currentTransaction = undefined; }
    };
    sequelize.query = async (sql, options = {}) => {
        assert.equal(options.transaction, currentTransaction, "Todas las consultas conservan la conexión retenida");
        if (sql.startsWith("WITH reloj")) { snapshotReads++; return [{ placeId: -2, votes: [] }]; }
        if (sql.includes('AS "hadFavorites"')) return [{ hadFavorites: false }];
        if (sql.includes("INSERT INTO public.favorites")) return [{ place_id: -2 }];
        if (sql.startsWith("SELECT id FROM public.places")) return [{ id: -2 }];
        if (sql.startsWith("SELECT level")) return [{ level: "SIN_DATOS" }];
        if (sql.includes("RETURNING attempts")) return [{ attempts: 1 }];
        if (sql.includes("FOR UPDATE OF o SKIP LOCKED")) return [{ id: "1", attempts: 1 }];
        return [];
    };
    assert.equal(await favorites.add(-1, -2, () => ({ level: null })), "added");
    assert.equal((await push.reconcilePlace({ placeId: -2, evaluate: () => ({ level: "MODERADO" }) })).kind, "CHANGED");
    assert.equal((await push.claimPending()).length, 1);
    assert.equal(await recovery.consumeLimits([{ keyHash: "a".repeat(64), maximum: 5 }]), true);
    assert.equal(snapshotReads, 2);
    assert.equal(transactions, 4);
});

test("el envío a FCM ocurre después de liberar la transacción del claim", async context => {
    const original = { transaction: sequelize.transaction, query: sequelize.query };
    context.after(() => Object.assign(sequelize, original));
    let held = false;
    let delivered = false;
    sequelize.transaction = async operation => {
        assert.equal(held, false);
        held = true;
        try { return await operation({}); }
        finally { held = false; }
    };
    sequelize.query = async sql => {
        if (sql.includes("FOR UPDATE OF o SKIP LOCKED")) return [{ id: "1", attempts: 1,
            targetType: "fcm-token", platform: "web", token: "synthetic-target", registrationId: "synthetic-binding" }];
        if (sql.includes("SELECT o.id FROM")) { assert.equal(held, false); return [{ id: "1" }]; }
        return [];
    };
    const service = new PushNotificationService({ repository: push, delivery: {
        isFcmConfigured: () => true, isInvalidTokenError: () => false,
        send: async () => { assert.equal(held, false); delivered = true; }
    } });
    assert.deepEqual(await service.dispatchPending(), { configured: true, sent: 1 });
    assert.equal(delivered, true);
});
