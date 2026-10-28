import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
const input = dotenv.parse(readFileSync(process.env.CROWDRADAR_HU7_QA_ENV_FILE));
assert.ok(
    !input.DATABASE_URL &&
        input.DB_NAME === "crowdradar_hu7_test" &&
        ["127.0.0.1", "localhost", "::1"].includes(input.DB_HOST),
    "Solo HU7 local aislado."
);
Object.assign(process.env, {
    ...input,
    DATABASE_URL: "",
    DB_SSL: "false",
    JWT_SECRET: randomBytes(48).toString("hex"),
    NODE_ENV: "test"
});
for (const key of [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "MAIL_FROM",
    "PASSWORD_RESET_URL"
])
    delete process.env[key];
const { default: db } = await import("../src/config/database.js");
const { migrateUserModeration, assertUserModerationSchemaReady } = await import(
    "../src/database/migrateUserModeration.js"
);
const { createAdminUserRepository } = await import("../src/repositories/AdminUserRepository.js");
const { AdminUserService } = await import("../src/services/AdminUserService.js");
const { default: app } = await import("../app.js");
const { default: bcrypt } = await import("bcrypt");
const { default: jwt } = await import("jsonwebtoken");
const select = async (sql, replacements = {}) => (await db.query(sql, { replacements }))[0];
let verified = false,
    server;
const ids = [],
    tag = randomBytes(8).toString("hex"),
    password = randomBytes(18).toString("hex");
const pass = (text) => console.log("PASS: " + text);
try {
    const [identity] = await select(
        "SELECT current_database() AS name,shobj_description(oid,'pg_database') AS provenance FROM pg_database WHERE datname=current_database()"
    );
    assert.equal(identity.name, "crowdradar_hu7_test");
    assert.equal(identity.provenance, "CrowdRadar/SW2/HU7/local-test/v1");
    verified = true;
    const before = await select(
        'SELECT id,rol,status,"sessionVersion",karma_points FROM public.users ORDER BY id'
    );
    const [migrationA, migrationB] = await Promise.all([
        migrateUserModeration(db),
        migrateUserModeration(db)
    ]);
    assert.ok(!(migrationA && migrationB));
    assert.equal(await migrateUserModeration(db), false);
    await assertUserModerationSchemaReady(db);
    pass(
        "008 aplicada explícitamente, idempotente/concurrente y sin cambiar estados/saldos existentes."
    );
    for (const [name, role] of [
        ["Admin", "ADMIN"],
        ["Ciudadano", "USUARIO"],
        ["OtroAdmin", "ADMIN"]
    ]) {
        const [row] = await select(
            `INSERT INTO public.users(nombre,apellido,email,"passwordHash",rol,status,"createdAt","updatedAt",karma_points)
   VALUES(:name,:tag,:email,:hash,:role,'ACTIVO',NOW(),NOW(),37) RETURNING id`,
            {
                name,
                tag,
                email: `${name}-${tag}@example.test`,
                hash: await bcrypt.hash(password, 10),
                role
            }
        );
        ids.push(row.id);
    }
    const [admin, target, otherAdmin] = ids;
    await new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", resolve);
    });
    const root = `http://127.0.0.1:${server.address().port}`;
    const call = (path, { token, body } = {}) =>
        fetch(root + path, {
            method: body === undefined ? "GET" : "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
    const login = async (email) => call("/api/auth/login", { body: { email, password } });
    const adminToken = (await (await login(`Admin-${tag}@example.test`)).json()).data.token;
    const oldToken = (await (await login(`Ciudadano-${tag}@example.test`)).json()).data.token;
    const resource = `/api/admin/users/${target}`;
    const resetHash = randomBytes(32).toString("hex");
    await db.query(
        "INSERT INTO public.password_reset_tokens(user_id,token_hash,expires_at) VALUES(:target,:hash,NOW()+INTERVAL '1 day')",
        { replacements: { target, hash: resetHash } }
    );
    const decisions = await Promise.all(
        [0, 1].map(() =>
            call(resource + "/suspend", {
                token: adminToken,
                body: { reason: "Motivo sintético de prueba", expectedVersion: 0 }
            })
        )
    );
    assert.deepEqual(decisions.map((r) => r.status).sort(), [200, 409]);
    const [suspended] = await select(
        'SELECT status,"sessionVersion",moderation_version,karma_points FROM public.users WHERE id=:target',
        { target }
    );
    assert.deepEqual(suspended, {
        status: "SUSPENDIDO",
        sessionVersion: 1,
        moderation_version: 1,
        karma_points: "37"
    });
    assert.ok(
        (
            await select(
                "SELECT consumed_at FROM public.password_reset_tokens WHERE token_hash=:hash",
                { hash: resetHash }
            )
        )[0].consumed_at
    );
    assert.equal((await call("/api/users/profile", { token: oldToken })).status, 401);
    const blockedLogin = await login(`Ciudadano-${tag}@example.test`);
    assert.equal(blockedLogin.status, 403);
    assert.deepEqual(await blockedLogin.json(), {
        code: "ACCOUNT_SUSPENDED",
        message:
            "Tu cuenta está suspendida. Un administrador debe reactivarla para que puedas volver a ingresar."
    });
    const wrongLogin = await call("/api/auth/login", {
        body: { email: `Ciudadano-${tag}@example.test`, password: "wrong-synthetic-password" }
    });
    const missingLogin = await call("/api/auth/login", {
        body: { email: `Missing-${tag}@example.test`, password }
    });
    assert.equal(wrongLogin.status, 401);
    assert.equal(missingLogin.status, 401);
    assert.deepEqual(await wrongLogin.json(), await missingLogin.json());
    pass(
        "dos suspensiones simultáneas:200/409, una decisión, sesiones/recovery invalidados y karma intacto."
    );
    assert.equal(
        (await call(resource + "/reactivate", { token: adminToken, body: { expectedVersion: 1 } }))
            .status,
        200
    );
    assert.equal((await call("/api/users/profile", { token: oldToken })).status, 401);
    const newLogin = await login(`Ciudadano-${tag}@example.test`);
    assert.equal(newLogin.status, 200);
    const freshToken = (await newLogin.json()).data.token;
    assert.equal((await call("/api/users/profile", { token: freshToken })).status, 200);
    const history = (await (await call(resource + "/history", { token: adminToken })).json()).data;
    assert.equal(history.length, 2);
    assert.deepEqual(
        history.map((a) => [a.action, a.reason]),
        [
            ["REACTIVATE", null],
            ["SUSPEND", "Motivo sintético de prueba"]
        ]
    );
    assert.ok(history.every((a) => a.adminId === admin && a.adminName === `Admin ${tag}`));
    assert.equal(
        (
            await call(resource + "/suspend", {
                token: adminToken,
                body: { reason: "Pantalla obsoleta", expectedVersion: 0 }
            })
        ).status,
        409
    );
    pass(
        "reactivación sin observación conserva ambos eventos; JWT antiguo sigue inválido, ingreso nuevo funciona, revisión evita ABA."
    );
    for (const id of [admin, otherAdmin])
        assert.equal(
            (
                await call(`/api/admin/users/${id}/suspend`, {
                    token: adminToken,
                    body: { reason: "No permitido", expectedVersion: 0 }
                })
            ).status,
            403
        );
    for (const suffix of ["/history", "/suspend", "/reactivate"])
        assert.equal(
            (
                await call(resource + suffix, {
                    token: freshToken,
                    ...(suffix === "/history"
                        ? {}
                        : { body: { reason: "No permitido", expectedVersion: 2 } })
                })
            ).status,
            403
        );
    assert.equal(
        (await call(resource + "/suspend", { body: { reason: "Sin sesión", expectedVersion: 2 } }))
            .status,
        401
    );
    assert.equal(
        (
            await call(resource + "/suspend", {
                token: adminToken,
                body: { reason: " ", expectedVersion: 2 }
            })
        ).status,
        400
    );
    pass(
        "ciudadanos/anónimos rechazados; administradores y propia cuenta no son moderables; motivo vacío rechazado."
    );
    const actor = jwt.decode(adminToken);
    const faultRepo = createAdminUserRepository({
        transaction: db.transaction.bind(db),
        query: (sql, options) => {
            if (sql.startsWith("INSERT INTO public.user_moderation_actions"))
                throw new Error("Fallo de auditoría inyectado");
            return db.query(sql, options);
        }
    });
    await assert.rejects(
        new AdminUserService(faultRepo).transition(
            actor,
            String(target),
            {},
            { reason: "Prueba rollback", expectedVersion: 2 },
            "SUSPEND"
        )
    );
    const [afterFailure] = await select(
        'SELECT status,"sessionVersion",moderation_version,karma_points FROM public.users WHERE id=:target',
        { target }
    );
    assert.deepEqual(afterFailure, {
        status: "ACTIVO",
        sessionVersion: 2,
        moderation_version: 2,
        karma_points: "37"
    });
    assert.equal(
        (
            await select(
                "SELECT COUNT(*) AS count FROM public.user_moderation_actions WHERE target_user_id=:target",
                { target }
            )
        )[0].count,
        "2"
    );
    pass(
        "fallo inyectado en inserción de auditoría revierte UPDATE real, versión y estado; no registro parcial."
    );
    const service = new AdminUserService(createAdminUserRepository(db));
    for (let version = 2; version < 24; version++)
        await service.transition(
            actor,
            String(target),
            {},
            version % 2 === 0
                ? { reason: "QA de paginación", expectedVersion: version }
                : { expectedVersion: version },
            version % 2 === 0 ? "SUSPEND" : "REACTIVATE"
        );
    const first = await service.history(actor, String(target), {}),
        second = await service.history(actor, String(target), {
            before: first.pagination.nextBefore
        });
    assert.equal(first.data.length, 20);
    assert.equal(second.data.length, 4);
    assert.equal(second.pagination.nextBefore, null);
    assert.equal(new Set([...first.data, ...second.data].map((a) => a.id)).size, 24);
    assert.deepEqual(
        await select(
            'SELECT id,rol,status,"sessionVersion",karma_points FROM public.users WHERE id NOT IN (:ids) ORDER BY id',
            { ids }
        ),
        before
    );
    pass(
        "24 decisiones persistidas en páginas20+4 sin duplicados; cuentas anteriores conservadas."
    );
} finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (verified && ids.length) {
        await db.query(
            "DELETE FROM public.user_moderation_actions WHERE target_user_id IN (:ids) AND admin_user_id IN (:ids)",
            { replacements: { ids } }
        );
        await db.query("DELETE FROM public.password_reset_tokens WHERE user_id IN (:ids)", {
            replacements: { ids }
        });
        await db.query("DELETE FROM public.users WHERE id IN (:ids) AND apellido=:tag", {
            replacements: { ids, tag }
        });
    }
    await db.close();
}
