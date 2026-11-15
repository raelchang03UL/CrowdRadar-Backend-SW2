import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";

// Runner explícito: nunca adopta la base habitual ni un destino remoto.
const input = dotenv.parse(readFileSync(process.env.CROWDRADAR_HU7_QA_ENV_FILE));
assert.ok(
    !input.DATABASE_URL &&
        input.DB_NAME === "crowdradar_hu7_test" &&
        ["localhost", "127.0.0.1", "::1"].includes(input.DB_HOST),
    "Solo la base HU7 local aislada."
);
Object.assign(process.env, {
    ...input,
    DATABASE_URL: "",
    DB_SSL: "false",
    NODE_ENV: "test",
    JWT_SECRET: randomBytes(48).toString("hex")
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
const { AdminUserService } = await import("../src/services/AdminUserService.js");
const { createAdminUserRepository } = await import("../src/repositories/AdminUserRepository.js");
const { default: jwt } = await import("jsonwebtoken");
const { default: app } = await import("../app.js");
const select = async (sql, replacements = {}) => (await db.query(sql, { replacements }))[0];
let server, placeId, reportId;
const ids = [],
    tag = randomBytes(8).toString("hex");
let verified = false;
try {
    const [identity] = await select(
        "SELECT current_database() AS name, shobj_description(oid,'pg_database') AS provenance FROM pg_database WHERE datname=current_database()"
    );
    assert.equal(identity.name, "crowdradar_hu7_test");
    assert.equal(identity.provenance, "CrowdRadar/SW2/HU7/local-test/v1");
    verified = true;
    const before = await select(
        'SELECT id,nombre,apellido,email,rol,status,"sessionVersion" FROM public.users ORDER BY id'
    );
    for (const [name, role, status] of [
        ["Admin", "ADMIN", "ACTIVO"],
        ["Bruno", "USUARIO", "ACTIVO"],
        ["Ana", "USUARIO", "SUSPENDIDO"],
        ["Lucía", "USUARIO", "ACTIVO"]
    ]) {
        const [account] = await select(
            `INSERT INTO public.users(nombre,apellido,email,"passwordHash",rol,status,"createdAt","updatedAt")
            VALUES(:name,:tag,:email,'not-a-login-hash',:role,:status,NOW(),NOW()) RETURNING id`,
            { name, tag, email: `${name.toLowerCase()}-${tag}@example.test`, role, status }
        );
        ids.push(account.id);
    }
    const [admin, author, denouncer, third] = ids;
    const actor = {
        id: admin,
        rol: "ADMIN",
        sessionVersion: 0,
        exp: Math.floor(Date.now() / 1000) + 3600
    };
    const service = new AdminUserService(createAdminUserRepository(db));
    placeId = (
        await select(
            "INSERT INTO public.places(nombre,categoria,latitud,longitud,demostrativo) VALUES(:name,'QA',-12,-77,TRUE) RETURNING id",
            { name: `HU7 ${tag}` }
        )
    )[0].id;
    reportId = (
        await select(
            "INSERT INTO public.saturation_reports(user_id,place_id,level) VALUES(:author,:placeId,'SATURADO') RETURNING id",
            { author, placeId }
        )
    )[0].id;
    for (const userId of [admin, denouncer, third])
        await db.query(
            "INSERT INTO public.report_denunciations(report_id,user_id,reason) VALUES(:reportId,:userId,'QA sintética')",
            { replacements: { reportId, userId } }
        );
    assert.equal((await service.detail(actor, String(author), {})).denouncedReportCount, 1);
    assert.equal((await service.detail(actor, String(third), {})).denouncedReportCount, 0);
    console.log(
        "PASS 1: tres denuncias sobre el mismo reporte cuentan como un reporte; cuenta sin reportes conserva cero."
    );
    for (const q of ["BRUNO", `bruno-${tag}@example.test`, `Bruno ${tag}`]) {
        assert.equal(
            (await service.list(actor, { q })).data.some((u) => u.id === author),
            true
        );
    }
    assert.deepEqual(
        (await service.list(actor, { q: tag, status: "SUSPENDIDO" })).data.map((u) => u.id),
        [denouncer]
    );
    for (const q of ["%", "_", "\\", "' OR 1=1 --", `sin-resultados-${tag}`]) {
        assert.deepEqual((await service.list(actor, { q })).data, []);
    }
    assert.deepEqual(
        (await service.list(actor, { q: tag, limit: "2", page: "2" })).data.map((u) => u.id),
        [denouncer, third]
    );
    assert.equal((await service.list(actor, { q: tag, limit: "2" })).pagination.hasNext, true);
    console.log(
        "PASS 2: SQL real filtra nombre completo/correo sin distinguir mayúsculas, estado, literales y páginas."
    );
    await new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", resolve);
    });
    const root = `http://127.0.0.1:${server.address().port}/api/admin/users`;
    const token = jwt.sign(
        { id: admin, rol: "USUARIO", sessionVersion: 0 },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
    );
    const response = await fetch(root + "/" + author, {
        headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(
        Object.keys((await response.json()).data).sort(),
        [
            "id",
            "nombre",
            "apellido",
            "email",
            "rol",
            "status",
            "denouncedReportCount",
            "moderationVersion"
        ].sort()
    );
    const forged = jwt.sign(
        { id: author, rol: "ADMIN", sessionVersion: 0 },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
    );
    assert.equal(
        (await fetch(root, { headers: { Authorization: `Bearer ${forged}` } })).status,
        403
    );
    assert.equal((await fetch(root)).status, 401);
    console.log(
        "PASS 3: HTTP y PostgreSQL reales toman el rol de la BD, rechazan ciudadano/anónimo y no exponen hash ni sesión."
    );
    await db.query("UPDATE public.users SET rol='USUARIO' WHERE id=:admin", {
        replacements: { admin }
    });
    await assert.rejects(service.list(actor, {}), { code: "ADMIN_REQUIRED" });
    await db.query("UPDATE public.users SET rol='ADMIN',\"sessionVersion\"=1 WHERE id=:admin", {
        replacements: { admin }
    });
    await assert.rejects(service.detail(actor, author + "", {}), { code: "SESSION_INVALID" });
    await db.query(
        "UPDATE public.users SET status='SUSPENDIDO',\"sessionVersion\"=0 WHERE id=:admin",
        { replacements: { admin } }
    );
    await assert.rejects(service.list(actor, {}), { code: "SESSION_INVALID" });
    assert.deepEqual(
        await select(
            'SELECT id,nombre,apellido,email,rol,status,"sessionVersion" FROM public.users WHERE id NOT IN (:ids) ORDER BY id',
            { ids }
        ),
        before
    );
    console.log(
        "PASS 4: revalidación transaccional de rol, versión y estado; cuentas anteriores intactas."
    );
} finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (verified) {
        if (reportId) {
            await db.query("DELETE FROM public.report_denunciations WHERE report_id=:reportId", {
                replacements: { reportId }
            });
            await db.query("DELETE FROM public.saturation_reports WHERE id=:reportId", {
                replacements: { reportId }
            });
        }
        if (placeId)
            await db.query("DELETE FROM public.places WHERE id=:placeId", {
                replacements: { placeId }
            });
        if (ids.length)
            await db.query("DELETE FROM public.users WHERE id IN (:ids) AND apellido=:tag", {
                replacements: { ids, tag }
            });
    }
    await db.close();
}
