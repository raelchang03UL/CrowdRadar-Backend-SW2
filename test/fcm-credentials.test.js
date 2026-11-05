import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { fcmServiceAccount } from "../src/config/fcmCredentials.js";
import { validateDeploymentEnvironment } from "../src/config/deployment.js";

const project = "crowdradar-synthetic-test";
const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ format: "pem", type: "pkcs8" });
const account = { type: "service_account", project_id: project,
    client_email: `sender@${project}.iam.gserviceaccount.com`, private_key: privateKey };

test("FCM acepta credencial privada del proyecto sin archivo ni conexión y omite metadatos extra", () => {
    const value = fcmServiceAccount({ FCM_PROJECT_ID: project, FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({ ...account, token_uri: "https://ignored.example" }) });
    assert.deepEqual(value, { projectId: project, clientEmail: account.client_email, privateKey });
    assert.equal(fcmServiceAccount({}), undefined);
});

test("credencial FCM inválida o de otro proyecto falla sin filtrar JSON ni clave", () => {
    for (const serialized of ["private-json-value", "null", JSON.stringify({ ...account, project_id: "another-project" }),
        JSON.stringify({ ...account, client_email: "another@example.test" }), JSON.stringify({ ...account, private_key: "private-key-value" })]) {
        assert.throws(() => fcmServiceAccount({ FCM_PROJECT_ID: project, FCM_SERVICE_ACCOUNT_JSON: serialized }), error => {
            assert.equal(error.code, "CONFIG_INVALID");
            assert.doesNotMatch(error.message, /private-json|private-key|another-project|PRIVATE KEY/);
            return true;
        });
    }
});

test("FCM desplegado exige ejecutor autenticado y credencial explícita; sinFCM continúa apagado", () => {
    const env = { NODE_ENV: "production", DATABASE_URL: "postgresql://qa@db.example/demo", JWT_SECRET: "x".repeat(40),
        PUSH_WORKER_ENABLED: "false", CORS_ORIGINS: "https://web.example" };
    assert.doesNotThrow(() => validateDeploymentEnvironment(env));
    assert.throws(() => validateDeploymentEnvironment({ ...env, FCM_PROJECT_ID: project }), { code: "CONFIG_INVALID" });
    const configured = { ...env, FCM_PROJECT_ID: project, FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(account) };
    assert.throws(() => validateDeploymentEnvironment(configured), { code: "CONFIG_INVALID" });
    assert.doesNotThrow(() => validateDeploymentEnvironment({ ...configured, SATURATION_EVENT_SECRET: "s".repeat(40) }));
});
