import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jsonwebtoken from "jsonwebtoken";
import app from "../app.js";
import users from "../src/repositories/UserRepository.js";
import repository, {
    createAdminUserRepository,
    literalUserPattern
} from "../src/repositories/AdminUserRepository.js";
import {
    AdminUserService,
    parseAdminUserQuery,
    parseAdminUserId,
    adminUserDto
} from "../src/services/AdminUserService.js";

const actor = { id: 1, rol: "ADMIN", sessionVersion: 0, exp: Math.floor(Date.now() / 1000) + 3600 };
const row = {
    id: 2,
    nombre: "Ana",
    apellido: "Rojas",
    email: "ana@example.invalid",
    rol: "USUARIO",
    status: "ACTIVO",
    denouncedReportCount: "2",
    moderationVersion: 0
};

test("HU7.2: filtros vacíos, parciales literales y paginación acotada", () => {
    assert.deepEqual(parseAdminUserQuery({}), { q: "", status: "", page: 1, limit: 20 });
    assert.deepEqual(
        parseAdminUserQuery({ q: "  ana%_\\  ", status: "ACTIVO", page: "2", limit: "5" }),
        { q: "ana%_\\", status: "ACTIVO", page: 2, limit: 5 }
    );
    assert.equal(literalUserPattern("%_\\"), "%\\%\\_\\\\%");
    for (const query of [
        null,
        [],
        { q: [] },
        { q: {} },
        { q: "x".repeat(161) },
        { status: ["ACTIVO"] },
        { status: "activo" },
        { role: "ADMIN" },
        { page: "0" },
        { page: "01" },
        { page: "1.5" },
        { page: "10001" },
        { limit: "51" },
        { limit: "-1" },
        { limit: ["1", "2"] }
    ]) {
        assert.throws(() => parseAdminUserQuery(query), { code: "ADMIN_QUERY_INVALID" });
    }
});

test("HU7.2: IDs y DTO no exponen datos privados ni aceptan conteos truncados", () => {
    assert.equal(parseAdminUserId("2147483647"), 2147483647);
    for (const id of ["0", "-1", "01", "1e2", "2147483648", "1;DROP", 1]) {
        assert.throws(() => parseAdminUserId(id), { code: "ADMIN_USER_ID_INVALID" });
    }
    assert.deepEqual(
        adminUserDto({ ...row, passwordHash: "private", sessionVersion: 8, telefono: "private" }),
        { ...row, denouncedReportCount: 2 }
    );
    assert.equal(adminUserDto({ ...row, rol: null, status: null }).status, null);
    for (const denouncedReportCount of [
        "9007199254740992",
        -1,
        "NaN",
        undefined,
        null,
        "",
        false
    ]) {
        assert.throws(() => adminUserDto({ ...row, denouncedReportCount }));
    }
});

test("HU7.2: servicio rechaza ciudadanos antes de consultar y obtiene siguiente página sin inventar totales", async () => {
    let calls = 0;
    const service = new AdminUserService({
        list: async () => {
            calls++;
            return [row, { ...row, id: 3 }, { ...row, id: 4 }];
        },
        detail: async () => null
    });
    await assert.rejects(service.list({ ...actor, rol: "USUARIO" }, {}), {
        code: "ADMIN_REQUIRED"
    });
    assert.equal(calls, 0);
    const result = await service.list(actor, { limit: "2" });
    assert.equal(result.data.length, 2);
    assert.deepEqual(result.pagination, { page: 1, limit: 2, hasNext: true });
    await assert.rejects(service.detail(actor, "2", {}), { code: "USER_NOT_FOUND" });
    await assert.rejects(service.detail(actor, "2", { rol: "ADMIN" }), {
        code: "ADMIN_QUERY_INVALID"
    });
});

test("HU7.2: SQL revalida actor bajo lock, limita tiempo y cuenta reportes distintos mediante EXISTS", async () => {
    const calls = [],
        transaction = {};
    const connection = {
        transaction: async (operation) => operation(transaction),
        query: async (sql, options) => {
            calls.push({ sql, options });
            if (sql.includes("FOR SHARE")) return [{ ...actor, status: "ACTIVO" }];
            return sql.startsWith("SELECT u.id") ? [row] : [];
        }
    };
    const repo = createAdminUserRepository(connection);
    await repo.list(actor, { q: "' OR 1=1 --%", status: "ACTIVO", page: 2, limit: 20 });
    assert.match(calls[0].sql, /SET LOCAL statement_timeout/);
    assert.match(calls[1].sql, /FOR SHARE/);
    assert.match(calls[2].sql, /EXISTS/);
    assert.doesNotMatch(calls[2].sql, /OR 1=1/);
    assert.equal(calls[2].options.replacements.offset, 20);
    assert.equal(calls[2].options.replacements.take, 21);
    assert.equal(calls[2].options.replacements.q, "' OR 1=1 --%");
    assert.ok(calls.every(({ options }) => options.transaction === transaction));
    for (const [current, code] of [
        [{ ...actor, status: "ACTIVO", rol: "USUARIO" }, "ADMIN_REQUIRED"],
        [{ ...actor, status: "SUSPENDIDO" }, "SESSION_INVALID"],
        [{ ...actor, status: "ACTIVO", sessionVersion: 1 }, "SESSION_INVALID"],
        [null, "SESSION_INVALID"]
    ]) {
        let reads = 0;
        const denied = createAdminUserRepository({
            transaction: async (op) => op({}),
            query: async (sql) => {
                if (sql.includes("FOR SHARE")) return current ? [current] : [];
                if (sql.startsWith("SELECT u.id")) reads++;
                return [];
            }
        });
        await assert.rejects(denied.detail(actor, 2), { code });
        assert.equal(reads, 0);
    }
});

const original = {
    session: users.findSessionById,
    list: repository.list,
    detail: repository.detail
};
const previousSecret = process.env.JWT_SECRET;
let server, base, current, seen;
before(() => {
    process.env.JWT_SECRET = "synthetic-admin-test-only-not-for-deployment";
    server = app.listen(0, "127.0.0.1");
    return new Promise((resolve) =>
        server.once("listening", () => {
            base = `http://127.0.0.1:${server.address().port}`;
            resolve();
        })
    );
});
beforeEach(() => {
    current = { ...actor, status: "ACTIVO" };
    seen = [];
    users.findSessionById = async () => current;
    repository.list = async (who, options) => {
        seen.push({ who, options });
        return [row];
    };
    repository.detail = async () => row;
});
after(async () => {
    users.findSessionById = original.session;
    repository.list = original.list;
    repository.detail = original.detail;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    await new Promise((resolve) => server.close(resolve));
});
const token = (payload = {}) =>
    jsonwebtoken.sign({ id: 1, sessionVersion: 0, ...payload }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: "1h"
    });
const request = (path, credential = token()) =>
    fetch(base + path, { headers: credential ? { Authorization: `Bearer ${credential}` } : {} });

test("HU7.2 HTTP: anónimo, token inválido, ciudadano, rol falsificado y cuenta suspendida no acceden", async () => {
    for (const credential of ["", "invalid-token"])
        assert.equal((await request("/api/admin/users", credential)).status, 401);
    current = { ...current, rol: "USUARIO" };
    for (const path of ["/api/admin/users", "/api/admin/users/2"]) {
        const response = await request(path, token({ rol: "ADMIN" }));
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, "ADMIN_REQUIRED");
        assert.equal(response.headers.get("cache-control"), "no-store");
    }
    assert.equal(seen.length, 0);
    current = { ...current, rol: "ADMIN", status: "SUSPENDIDO" };
    assert.equal((await request("/api/admin/users")).status, 401);
});

test("HU7.2 HTTP: lista y detalle solo para administrador; filtros recortados y DTO mínimo", async () => {
    let response = await request("/api/admin/users?q=%20ANA%20&status=ACTIVO&page=2&limit=10");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(seen[0].options, { q: "ANA", status: "ACTIVO", page: 2, limit: 10 });
    assert.equal(seen[0].who.rol, "ADMIN");
    assert.equal((await response.json()).data[0].denouncedReportCount, 2);
    response = await request("/api/admin/users/2");
    assert.deepEqual((await response.json()).data, { ...row, denouncedReportCount: 2 });
    repository.list = async () => [];
    response = await request("/api/admin/users?q=sin-coincidencia");
    assert.deepEqual(await response.json(), {
        data: [],
        pagination: { page: 1, limit: 20, hasNext: false }
    });
});

test("HU7.2 HTTP: query repetida, desconocida, ID inválido y usuario ausente tienen errores públicos", async () => {
    for (const path of [
        "/api/admin/users?q=a&q=b",
        "/api/admin/users?status=activo",
        "/api/admin/users?page=0",
        "/api/admin/users?limit=51",
        "/api/admin/users?role=ADMIN",
        "/api/admin/users/2?extra=x",
        "/api/admin/users/01"
    ]) {
        assert.equal((await request(path)).status, 400, path);
    }
    repository.detail = async () => null;
    assert.equal((await request("/api/admin/users/2")).status, 404);
});

test("HU7.2 HTTP: caída de sesión o consultas falla cerrado sin SQL, correo o credenciales", async () => {
    repository.list = repository.detail = async () => {
        throw Error("private SQL passwordHash secret@example.invalid");
    };
    for (const path of ["/api/admin/users", "/api/admin/users/2"]) {
        const response = await request(path);
        assert.equal(response.status, 503);
        assert.doesNotMatch(await response.text(), /SQL|passwordHash|secret@/);
    }
    users.findSessionById = async () => {
        throw Error("private DB");
    };
    assert.equal((await request("/api/admin/users")).status, 503);
});
