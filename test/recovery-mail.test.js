import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { mailConfiguration } from "../src/config/mail.js";
import { createRecoveryMailDelivery, createSmtpRecoveryDelivery } from "../src/services/RecoveryMailDelivery.js";
import { recoveryServiceFromEnvironment } from "../app.js";

const gmail = {
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "465",
    SMTP_USER: "equipo.qa@example.test",
    SMTP_PASSWORD: "abcd efgh ijkl mnop",
    PASSWORD_RESET_URL: "http://localhost:5500/#/reset-password"
};
const resetUrl = "http://localhost:5500/#/reset-password?token=" + "a".repeat(64) + "&x=<y>";

test("sin variables SMTP la entrega queda deshabilitada", () => {
    assert.equal(mailConfiguration({}), null);
    assert.equal(mailConfiguration({ SMTP_HOST: "  " }), null);
    assert.equal(recoveryServiceFromEnvironment({}, () => assert.fail("No debe crear transporte")), undefined);
});

test("configuración SMTP incompleta o inválida detiene el arranque sin revelar la contraseña", () => {
    const secret = "contraseña-que-no-debe-salir";
    const cases = [
        [{ SMTP_HOST: "smtp.gmail.com", SMTP_PASSWORD: secret }, /faltan SMTP_PORT, SMTP_USER/],
        [{ MAIL_FROM: "CrowdRadar <equipo.qa@example.test>" }, /faltan SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD/],
        [{ ...gmail, SMTP_PASSWORD: secret, SMTP_PORT: "correo" }, /SMTP_PORT/],
        [{ ...gmail, SMTP_PASSWORD: secret, PASSWORD_RESET_URL: "" }, /PASSWORD_RESET_URL/],
        [{ ...gmail, SMTP_PASSWORD: secret, PASSWORD_RESET_URL: "http://crowdradar.example/#/reset-password" }, /HTTPS/]
    ];
    for (const [env, message] of cases) {
        assert.throws(() => mailConfiguration(env), (error) => {
            assert.equal(error.code, "CONFIG_INVALID");
            assert.match(error.message, message);
            assert.doesNotMatch(error.message, new RegExp(secret));
            return true;
        });
    }
});

test(".env.example conserva el fragmento #/reset-password al leerse con dotenv", () => {
    const example = dotenv.parse(readFileSync(new URL("../.env.example", import.meta.url)));
    assert.equal(example.PASSWORD_RESET_URL, gmail.PASSWORD_RESET_URL);
    assert.equal(mailConfiguration({ ...gmail, PASSWORD_RESET_URL: example.PASSWORD_RESET_URL }).resetUrl, gmail.PASSWORD_RESET_URL);
});

test("Gmail usa TLS, quita espacios de la contraseña de aplicación y remitente por defecto", () => {
    const config = mailConfiguration(gmail);
    assert.equal(config.secure, true);
    assert.equal(config.password, "abcdefghijklmnop");
    assert.deepEqual(config.from, { name: "CrowdRadar", address: gmail.SMTP_USER });
    assert.equal(config.resetUrl, gmail.PASSWORD_RESET_URL);

    const starttls = mailConfiguration({ ...gmail, SMTP_PORT: "587", MAIL_FROM: "Equipo <equipo.qa@example.test>" });
    assert.equal(starttls.secure, false);
    assert.equal(starttls.from, "Equipo <equipo.qa@example.test>");
    assert.equal(mailConfiguration({ ...gmail, SMTP_HOST: "smtp.example.test" }).password, gmail.SMTP_PASSWORD);
});

test("Brevo exige MAIL_FROM: ausente o vacío detiene el arranque sin revelar la clave", () => {
    const secret = "xsmtpsib-clave-que-no-debe-salir";
    const brevo = { ...gmail, SMTP_HOST: "smtp-relay.sendinblue.com", SMTP_PORT: "587", SMTP_USER: "login@smtp-brevo.com", SMTP_PASSWORD: secret };
    for (const env of [brevo, { ...brevo, MAIL_FROM: "   " }, { ...brevo, SMTP_HOST: "smtp-relay.brevo.com" }]) {
        assert.throws(() => mailConfiguration(env), (error) => {
            assert.equal(error.code, "CONFIG_INVALID");
            assert.match(error.message, /MAIL_FROM/);
            assert.doesNotMatch(error.message, new RegExp(secret));
            return true;
        });
    }

    const valid = mailConfiguration({ ...brevo, MAIL_FROM: "CrowdRadar <remitente@example.test>" });
    assert.equal(valid.from, "CrowdRadar <remitente@example.test>");
    assert.equal(valid.secure, false);
    assert.equal(valid.password, secret);
});

test("correo de recuperación contiene el enlace escapado y el aviso no incluye enlaces", async () => {
    const sent = [];
    const delivery = createRecoveryMailDelivery({ sendMail: async (message) => { sent.push(message); }, from: "CrowdRadar <equipo.qa@example.test>" });
    await delivery.sendResetLink({ email: "ciudadano@example.test", resetUrl });
    await delivery.sendPasswordChangedNotification({ email: "ciudadano@example.test" });

    const [reset, notice] = sent;
    assert.equal(reset.to, "ciudadano@example.test");
    assert.equal(reset.from, "CrowdRadar <equipo.qa@example.test>");
    assert.ok(reset.text.includes(resetUrl));
    assert.match(reset.text, /15 minutos/);
    assert.ok(reset.html.includes(`href="${resetUrl.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}"`));
    assert.doesNotMatch(reset.html, /<y>/);
    assert.equal(notice.to, "ciudadano@example.test");
    assert.doesNotMatch(notice.text, /token|http/);
    assert.equal(notice.html, undefined);
});

test("fallo del proveedor registra solo el código y propaga el error", async (t) => {
    const logged = t.mock.method(console, "error", () => {});
    const failure = Object.assign(new Error(`535 rechazado para ${resetUrl}`), { code: "EAUTH" });
    const delivery = createRecoveryMailDelivery({ sendMail: async () => { throw failure; }, from: "x@example.test" });

    await assert.rejects(delivery.sendResetLink({ email: "ciudadano@example.test", resetUrl }), failure);
    assert.equal(logged.mock.callCount(), 1);
    const line = logged.mock.calls[0].arguments.join(" ");
    assert.match(line, /EAUTH/);
    assert.doesNotMatch(line, /ciudadano|token|localhost|535/);
});

test("arranque con SMTP construye el servicio con entrega y URL confiable, sin conectar", () => {
    let received;
    const fake = { sendResetLink: async () => {}, sendPasswordChangedNotification: async () => {} };
    const service = recoveryServiceFromEnvironment(gmail, (config) => { received = config; return fake; });
    assert.equal(service.delivery, fake);
    assert.equal(service.resetUrl, gmail.PASSWORD_RESET_URL);
    assert.equal(received.host, "smtp.gmail.com");

    // nodemailer solo abre la conexión al enviar: construir el adaptador real no usa la red.
    const real = createSmtpRecoveryDelivery(mailConfiguration(gmail));
    assert.equal(typeof real.sendResetLink, "function");
    assert.equal(typeof real.sendPasswordChangedNotification, "function");
});
