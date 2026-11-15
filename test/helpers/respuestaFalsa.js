import { mock } from "node:test";

// Doble de prueba de `res` de Express. Cada método es un Spy (mock.fn), así las
// pruebas pueden verificar con qué estado y cuerpo respondió la unidad.
export function respuestaFalsa() {
    const res = {
        statusCode: 200,
        body: undefined,
        headers: {},
        status: mock.fn(function (code) { res.statusCode = code; return res; }),
        json: mock.fn(function (body) { res.body = body; return res; }),
        set: mock.fn(function (name, value) { res.headers[name] = value; return res; }),
        end: mock.fn(function () { return res; })
    };
    return res;
}
