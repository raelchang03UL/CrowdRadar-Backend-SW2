import test from "node:test";
import assert from "node:assert/strict";
import { migrateSaturationAlerts, saturationAlertsMigration } from "../src/database/migrateSaturationAlerts.js";
import {
    PushNotificationService
} from "../src/services/PushNotificationService.js";
import { matchesSaturationSecret } from "../src/controllers/SaturationEventController.js";

test("una inicialización y un nivel sin cambios no crean alertas", async () => {
    const calls = [];
    const service = new PushNotificationService({
        repository: {
            async reconcilePlace(value) {
                calls.push(value.placeId);
                return { kind: calls.length === 1 ? "INITIALIZED" : "UNCHANGED" };
            }
        }
    });
    assert.deepEqual(await service.reconcilePlace({ placeId: 7 }), {
        changed: false,
        initialized: true
    });
    assert.deepEqual(await service.reconcilePlace({ placeId: 7 }), {
        changed: false,
        initialized: false
    });
    assert.deepEqual(calls, [
        7,
        7
    ]);
});

test("un nivel distinto crea una transición y despacha el evento a los dispositivos favoritos", async () => {
    const sent = [];
    const delivered = [];
    const repository = {
        async reconcilePlace() {
            return { kind: "CHANGED", previousLevel: "TRANQUILO", level: "SATURADO" };
        },
        async isEligible() { return true; },
        async claimPending() {
            return [{
                id: 1,
                deviceTokenId: 2,
                placeId: 7,
                placeName: "Parque Central",
                previousLevel: "TRANQUILO",
                newLevel: "SATURADO",
                token: "registered-device-token",
                attempts: 1, userId: 12, sessionVersion: 0, registrationId: "qa-binding", platform: "web"
            }];
        },
        async markDelivered(id) {
            delivered.push(id);
        },
        async markFailed() {
            assert.fail("La entrega no debe fallar.");
        }
    };
    const service = new PushNotificationService({
        repository,
        delivery: {
            isFcmConfigured: () => true,
            isInvalidTokenError: () => false,
            async send(message) {
                sent.push(message);
            }
        }
    });
    assert.deepEqual(await service.reconcilePlace({ placeId: 7 }), {
        changed: true,
        previousLevel: "TRANQUILO",
        newLevel: "SATURADO"
    });
    assert.deepEqual(await service.dispatchPending(), { configured: true, sent: 1 });
    assert.equal(sent[0].fid, "registered-device-token");
    assert.equal(sent[0].notification, undefined);
    assert.deepEqual(sent[0].data, {
        placeId: "7", userId: "12", sessionVersion: "0", registrationId: "qa-binding",
        previousLevel: "TRANQUILO",
        newLevel: "SATURADO"
    });
    assert.deepEqual(delivered, [1]);
});

test("cola pendiente no intenta enviar cuando FCM no está configurado", async () => {
    let claims = 0;
    const service = new PushNotificationService({
        repository: { claimPending: async () => { claims++; return []; } },
        delivery: { isFcmConfigured: () => false }
    });
    assert.deepEqual(await service.dispatchPending(), { configured: false, sent: 0 });
    assert.equal(claims, 0);
});

test("la fuente de saturación exige un secreto y la comparación no acepta valores parciales", () => {
    const secret = "un-secreto-interno-con-32-caracteres";
    assert.equal(matchesSaturationSecret(secret, secret), true);
    assert.equal(matchesSaturationSecret("incorrecto", secret), false);
    assert.equal(matchesSaturationSecret(undefined, secret), false);
    assert.equal(matchesSaturationSecret(secret, ""), false);
});

test("migración de alertas es transaccional e idempotente", async () => {
    let applied = false;
    let transactions = 0;
    const queries = [];
    const connection = {
        transaction: async (operation) => {
            transactions++;
            return operation({ id: transactions });
        },
        query: async (sql, options = {}) => {
            assert.ok(options.transaction);
            queries.push(sql);
            if (sql.startsWith("SELECT name")) {
                return applied ? [{ name: saturationAlertsMigration }] : [];
            }
            if (sql.includes("information_schema.tables")) return [];
            if (sql.startsWith("INSERT INTO public.crowdradar_migrations")) applied = true;
            return [];
        }
    };
    assert.equal(await migrateSaturationAlerts(connection), true);
    assert.equal(await migrateSaturationAlerts(connection), false);
    assert.equal(transactions, 2);
    assert.equal(queries.filter((query) => query.startsWith("CREATE TABLE public.push_device_tokens")).length, 1);
    assert.equal(queries.filter((query) => query.startsWith("CREATE TABLE public.place_saturation")).length, 1);
    assert.equal(queries.filter((query) => query.startsWith("CREATE TABLE public.push_notification_outbox")).length, 1);
    assert.ok(queries.every((query) => !/DROP|DELETE FROM public.users|ALTER TABLE public.users/i.test(query)));
});


test("una entrega reclamada antes de cambiar binding no llega al proveedor", async () => {
    let sent = 0;
    const service = new PushNotificationService({ repository: {
        claimPending: async () => [{ id: 1 }], isEligible: async () => false
    }, delivery: { isFcmConfigured: () => true, send: async () => { sent++; } } });
    assert.deepEqual(await service.dispatchPending(), { configured: true, sent: 0 });
    assert.equal(sent, 0);
});
