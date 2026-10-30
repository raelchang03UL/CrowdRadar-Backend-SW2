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
const { migrateReportModeration, assertReportModerationSchemaReady } = await import(
    "../src/database/migrateReportModeration.js"
);
const { createAdminReportRepository } = await import(
    "../src/repositories/AdminReportRepository.js"
);
const { AdminReportService } = await import("../src/services/AdminReportService.js");
const { default: app } = await import("../app.js");
const { default: jwt } = await import("jsonwebtoken");
const select = async (sql, replacements = {}) => (await db.query(sql, { replacements }))[0];
const pass = (text) => console.log("PASS: " + text);
const ids = [],
    tag = randomBytes(8).toString("hex");
let verified = false,
    server,
    placeId;
try {
    const [identity] = await select(
        "SELECT current_database() AS name,shobj_description(oid,'pg_database') AS provenance FROM pg_database WHERE datname=current_database()"
    );
    assert.equal(identity.name, "crowdradar_hu7_test");
    assert.equal(identity.provenance, "CrowdRadar/SW2/HU7/local-test/v1");
    verified = true;
    const initialReports = await select(
        "SELECT id,user_id,place_id,level,created_at FROM public.saturation_reports ORDER BY id"
    );
    const applied = await Promise.all([migrateReportModeration(db), migrateReportModeration(db)]);
    assert.ok(!(applied[0] && applied[1]));
    assert.equal(await migrateReportModeration(db), false);
    await assertReportModerationSchemaReady(db);
    assert.deepEqual(
        await select(
            "SELECT id,user_id,place_id,level,created_at FROM public.saturation_reports ORDER BY id"
        ),
        initialReports
    );
    const baseline = await select(
        'SELECT id,status,rol,"sessionVersion",moderation_version,karma_points FROM public.users ORDER BY id'
    );
    const reportsBefore = await select(
        "SELECT id,is_public,review_decision,moderation_version,reviewed_denunciations FROM public.saturation_reports ORDER BY id"
    );
    pass("009 explícita, aditiva, idempotente/concurrente; reportes previos conservados.");
    const addUser = async (name, role = "USUARIO") => {
        const [row] = await select(
            `INSERT INTO public.users(nombre,apellido,email,"passwordHash",rol,status,"createdAt","updatedAt",karma_points)
   VALUES(:name,:tag,:email,'not-a-login-hash',:role,'ACTIVO',NOW(),NOW(),37) RETURNING id`,
            { name, tag, email: `${name}-${tag}@example.test`, role }
        );
        ids.push(row.id);
        return row.id;
    };
    const admin = await addUser("Admin", "ADMIN"),
        author = await addUser("Autor"),
        b = await addUser("Segundo"),
        c = await addUser("Tercero"),
        d = await addUser("Cuarto");
    const token = (id) =>
            jwt.sign({ id, rol: "FORGED_IGNORED", sessionVersion: 0 }, process.env.JWT_SECRET, {
                expiresIn: "1h"
            }),
        adminToken = token(admin),
        authorToken = token(author);
    await new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", resolve);
    });
    const root = `http://127.0.0.1:${server.address().port}`;
    const call = (path, { credential = adminToken, body } = {}) =>
        fetch(root + path, {
            method: body === undefined ? "GET" : "POST",
            headers: {
                "Content-Type": "application/json",
                ...(credential ? { Authorization: `Bearer ${credential}` } : {})
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
    const data = async (path, options) => {
        const response = await call(path, options);
        assert.equal(response.status, 200, path);
        return (await response.json()).data;
    };
    placeId = (
        await select(
            "INSERT INTO public.places(nombre,categoria,latitud,longitud,demostrativo) VALUES(:name,'QA HU7',-12,-77,TRUE) RETURNING id",
            { name: `Prueba ${tag}` }
        )
    )[0].id;
    const created = await call(`/api/places/${placeId}/reports`, {
        credential: authorToken,
        body: { level: "SATURADO" }
    });
    assert.equal(created.status, 201);
    const mainId = String((await created.json()).data.id),
        path = `/api/admin/reports/${mainId}`;
    for (const userId of [b, c])
        await db.query(
            "INSERT INTO public.saturation_reports(user_id,place_id,level,created_at) VALUES(:userId,:placeId,'SATURADO',clock_timestamp())",
            { replacements: { userId, placeId } }
        );
    const denounce = async (id, user, reason) =>
        call(`/api/reports/${id}/denunciations`, {
            credential: token(user),
            body: reason === null ? {} : { reason }
        });
    for (const [user, reason] of [
        [admin, "No coincide"],
        [b, "No coincide"],
        [c, null]
    ])
        assert.equal((await denounce(mainId, user, reason)).status, 201);
    let detail = await data(path);
    assert.equal(detail.denunciationCount, 3);
    assert.deepEqual(detail.reasons, [
        { reason: "No coincide", count: 2 },
        { reason: null, count: 1 }
    ]);
    assert.deepEqual(Object.keys(detail.author).sort(), ["id", "name", "rol"]);
    assert.ok(!("denouncerIds" in detail));
    assert.equal((await call("/api/admin/reports", { credential: authorToken })).status, 403);
    assert.equal((await call(path, { credential: "" })).status, 401);
    pass(
        "total3 = motivos2+1, grupo sin motivo, autor explícito sin identidades de denunciantes; permisos HTTP reales."
    );
    const decision = async (id, choice, version, total) =>
        call(`/api/admin/reports/${id}/decision`, {
            body: {
                decision: choice,
                reason: "Revisión sintética HU7",
                expectedVersion: version,
                expectedDenunciationCount: total
            }
        });
    assert.equal((await decision(mainId, "KEEP", 0, 3)).status, 200);
    detail = await data(path);
    assert.equal(detail.reviewState, "KEPT");
    assert.equal(detail.moderationVersion, 1);
    assert.equal((await denounce(mainId, d, "Motivo nuevo")).status, 201);
    detail = await data(path);
    assert.equal(detail.reviewState, "PENDING");
    assert.equal(detail.denunciationCount, 4);
    assert.equal(detail.reviewedDenunciationCount, 3);
    assert.ok((await data("/api/admin/reports")).some((r) => r.id === mainId));
    assert.equal((await decision(mainId, "REMOVE", 1, 3)).status, 409);
    pass(
        "conservar no oculta; una denuncia nueva vuelve a Pendiente y una pantalla con total antiguo recibe409."
    );
    const actor = { ...jwt.decode(adminToken), rol: "ADMIN" };
    const faulty = createAdminReportRepository({
        transaction: db.transaction.bind(db),
        query: (sql, options) => {
            if (sql.startsWith("INSERT INTO public.report_moderation_actions"))
                throw new Error("Fallo de auditoría inyectado");
            return db.query(sql, options);
        }
    });
    await assert.rejects(
        new AdminReportService(faulty).decide(
            actor,
            mainId,
            {},
            {
                decision: "REMOVE",
                reason: "Prueba rollback",
                expectedVersion: 1,
                expectedDenunciationCount: 4
            }
        ),
        /Fallo de auditoría inyectado/
    );
    detail = await data(path);
    assert.equal(detail.isPublic, true);
    assert.equal(detail.moderationVersion, 1);
    assert.equal((await data(`/api/places/${placeId}/saturation`)).reportCount, 3);
    assert.ok(
        (await data(`/api/places?categoria=${encodeURIComponent("QA HU7")}&nivel=SATURADO`)).some(
            (p) => p.id === placeId
        )
    );
    const simultaneous = await Promise.all([
        decision(mainId, "REMOVE", 1, 4),
        decision(mainId, "REMOVE", 1, 4)
    ]);
    assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 409]);
    detail = await data(path);
    assert.equal(detail.reviewState, "REMOVED");
    assert.equal(detail.isPublic, false);
    const complete = await (await call(path)).json();
    assert.deepEqual(
        complete.history.map((h) => h.decision),
        ["REMOVE", "KEEP"]
    );
    pass(
        "fallo de auditoría revierte retiro SQL; doble decisión produce200/409 y dos eventos KEEP/REMOVE conservados."
    );
    assert.ok(!(await data("/api/reports", { credential: token(b) })).some((r) => r.id === mainId));
    assert.equal((await call(`/api/reports/${mainId}`, { credential: authorToken })).status, 404);
    assert.equal(
        (await data(`/api/reports/${mainId}/own-validation`, { credential: authorToken }))
            .removedFromPublic,
        true
    );
    assert.equal(
        (await call(`/api/reports/${mainId}/own-validation`, { credential: token(b) })).status,
        404
    );
    assert.equal(
        (
            await call(`/api/reports/${mainId}/validations`, {
                credential: token(d),
                body: { decision: "CONFIRM" }
            })
        ).status,
        404
    );
    assert.equal((await denounce(mainId, d, "Nueva después de retiro")).status, 404);
    assert.equal(
        (await data("/api/users/reports", { credential: authorToken })).find((r) => r.id === mainId)
            .isPublic,
        false
    );
    assert.equal((await data(`/api/places/${placeId}/saturation`)).reportCount, 2);
    assert.ok(
        !(await data(`/api/places?categoria=${encodeURIComponent("QA HU7")}&nivel=SATURADO`)).some(
            (p) => p.id === placeId
        )
    );
    const [authorAfter] = await select(
        'SELECT status,"sessionVersion",karma_points FROM public.users WHERE id=:author',
        { author }
    );
    assert.deepEqual(authorAfter, { status: "ACTIVO", sessionVersion: 0, karma_points: "47" });
    assert.equal(
        (
            await select(
                "SELECT COUNT(*) AS count FROM public.report_karma_awards WHERE report_id=:id",
                { id: mainId }
            )
        )[0].count,
        "1"
    );
    const cooldown = await call(`/api/places/${placeId}/reports`, {
        credential: authorToken,
        body: { level: "SATURADO" }
    });
    assert.equal(cooldown.status, 409);
    assert.equal((await decision(mainId, "KEEP", 2, 4)).status, 409);
    pass(
        "retiro excluido de lista/detalle/participación/saturación/filtro; autor conserva evidencia privada, cuenta activa,47puntos y premio único; cooldown intacto."
    );
    let historicalTarget;
    for (const day of ["12", "13", "14"])
        for (const userId of [author, b, c]) {
            const [report] = await select(
                "INSERT INTO public.saturation_reports(user_id,place_id,level,created_at) VALUES(:userId,:placeId,'TRANQUILO',:created) RETURNING id",
                { userId, placeId, created: `2026-10-${day}T15:10:00Z` }
            );
            if (day === "12" && userId === author) historicalTarget = String(report.id);
        }
    assert.equal((await denounce(historicalTarget, b, "Revisión histórica")).status, 201);
    const range = "from=2026-10-12&to=2026-10-14",
        analytics = `/api/places/${placeId}`;
    assert.equal((await data(analytics + "/history?" + range)).sufficient, 3);
    assert.equal((await data(analytics + "/quiet-hours?" + range)).recommendations[0].quietDays, 3);
    assert.equal((await decision(historicalTarget, "REMOVE", 0, 1)).status, 200);
    assert.equal((await data(analytics + "/history?" + range)).sufficient, 2);
    assert.equal((await data(analytics + "/quiet-hours?" + range)).reason, "INSUFFICIENT_HISTORY");
    const compared = await data(
        analytics + "/comparison?" + range + "&compareFrom=2026-10-12&compareTo=2026-10-12"
    );
    assert.equal(compared.first.sufficient, 2);
    assert.equal(compared.second.sufficient, 0);
    pass(
        "analíticas públicas recalculadas: historia3→2, comparación y recomendación dejan de usar el reporte histórico retirado."
    );
    const [protectedReport] = await select(
        "INSERT INTO public.saturation_reports(user_id,place_id,level) VALUES(:admin,:placeId,'TRANQUILO') RETURNING id",
        { admin, placeId }
    );
    assert.equal(
        (await denounce(String(protectedReport.id), b, "Reporte de administrador")).status,
        201
    );
    assert.equal((await decision(String(protectedReport.id), "REMOVE", 0, 1)).status, 403);
    const [raceReport] = await select(
        "INSERT INTO public.saturation_reports(user_id,place_id,level) VALUES(:author,:placeId,'TRANQUILO') RETURNING id",
        { author, placeId }
    );
    const raceId = String(raceReport.id);
    assert.equal((await denounce(raceId, b, "Inicial")).status, 201);
    const [withdrawRace, denounceRace] = await Promise.all([
        decision(raceId, "REMOVE", 0, 1),
        denounce(raceId, d, "Denuncia simultánea")
    ]);
    assert.ok(
        (withdrawRace.status === 200 && denounceRace.status === 404) ||
            (withdrawRace.status === 409 && denounceRace.status === 201)
    );
    if (withdrawRace.status === 409)
        assert.equal((await decision(raceId, "REMOVE", 0, 2)).status, 200);
    pass(
        "autor administrador protegido; carrera denuncia/retiro se serializa sin aceptar una decisión con total obsoleto."
    );
    const [paginationReport] = await select(
        "INSERT INTO public.saturation_reports(user_id,place_id,level) VALUES(:author,:placeId,'TRANQUILO') RETURNING id",
        { author, placeId }
    );
    const paginationId = String(paginationReport.id),
        service = new AdminReportService(createAdminReportRepository(db));
    for (let version = 0; version < 23; version++) {
        const denouncer = await addUser("Pagina" + version);
        await db.query(
            "INSERT INTO public.report_denunciations(report_id,user_id,reason) VALUES(:id,:denouncer,'QA de páginas')",
            { replacements: { id: paginationId, denouncer } }
        );
        await service.decide(
            actor,
            paginationId,
            {},
            {
                decision: "KEEP",
                reason: "Decisión de prueba paginada",
                expectedVersion: version,
                expectedDenunciationCount: version + 1
            }
        );
    }
    const first = await service.detail(actor, paginationId, {}),
        second = await service.detail(actor, paginationId, {
            beforeHistory: first.historyPagination.nextBefore
        });
    assert.equal(first.history.length, 20);
    assert.equal(second.history.length, 3);
    assert.equal(second.historyPagination.nextBefore, null);
    assert.equal(new Set([...first.history, ...second.history].map((h) => h.id)).size, 23);
    for (let index = 0; index < 21; index++) {
        const [report] = await select(
            "INSERT INTO public.saturation_reports(user_id,place_id,level) VALUES(:author,:placeId,'TRANQUILO') RETURNING id",
            { author, placeId }
        );
        await db.query(
            "INSERT INTO public.report_denunciations(report_id,user_id,reason) VALUES(:id,:b,'QA lista paginada')",
            { replacements: { id: String(report.id), b } }
        );
    }
    const listFirst = await service.list(actor, { state: "ALL", authorId: String(author) }),
        listSecond = await service.list(actor, {
            state: "ALL",
            authorId: String(author),
            before: listFirst.pagination.nextBefore
        });
    assert.equal(listFirst.data.length, 20);
    assert.equal(listSecond.data.length, 5);
    assert.equal(listSecond.pagination.nextBefore, null);
    assert.equal(new Set([...listFirst.data, ...listSecond.data].map((r) => r.id)).size, 25);
    assert.deepEqual(
        await select(
            'SELECT id,status,rol,"sessionVersion",moderation_version,karma_points FROM public.users WHERE id NOT IN (:ids) ORDER BY id',
            { ids }
        ),
        baseline
    );
    assert.deepEqual(
        await select(
            "SELECT id,is_public,review_decision,moderation_version,reviewed_denunciations FROM public.saturation_reports WHERE place_id<>:placeId ORDER BY id",
            { placeId }
        ),
        reportsBefore
    );
    pass(
        "historial SQL23 decisiones en páginas20+3 sin duplicados/orden lexicográfico; cuentas y reportes anteriores intactos."
    );
} finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (verified && placeId) {
        const params = { placeId };
        for (const table of [
            "report_moderation_actions",
            "report_validations",
            "report_denunciations",
            "report_karma_awards"
        ])
            await db.query(
                `DELETE FROM public.${table} WHERE report_id IN (SELECT id FROM public.saturation_reports WHERE place_id=:placeId)`,
                { replacements: params }
            );
        await db.query("DELETE FROM public.saturation_reports WHERE place_id=:placeId", {
            replacements: params
        });
        await db.query("DELETE FROM public.places WHERE id=:placeId", { replacements: params });
    }
    if (verified && ids.length)
        await db.query("DELETE FROM public.users WHERE id IN (:ids) AND apellido=:tag", {
            replacements: { ids, tag }
        });
    await db.close();
}
