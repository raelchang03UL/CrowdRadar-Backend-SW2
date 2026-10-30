import nodemailer from "nodemailer";

const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);

// Adaptador de PasswordRecoveryService. No registra destinatarios, enlaces ni tokens.
export function createRecoveryMailDelivery({ sendMail, from }) {
    const send = async (kind, message) => {
        try {
            await sendMail({ from, ...message });
        } catch (error) {
            // Solo el código (p. ej. EAUTH: contraseña de aplicación rechazada) para diagnosticar sin exponer datos.
            console.error(`No se pudo enviar el correo de ${kind} (${error?.code ?? "ERROR"}).`);
            throw error;
        }
    };
    return {
        sendResetLink: ({ email, resetUrl }) => send("recuperación", {
            to: email,
            subject: "CrowdRadar: restablece tu contraseña",
            text: [
                "Hola:",
                "",
                "Recibimos una solicitud para restablecer la contraseña de tu cuenta CrowdRadar. Abre este enlace para elegir una nueva:",
                "",
                resetUrl,
                "",
                "El enlace vence en 15 minutos y solo puede usarse una vez. Si no lo solicitaste, ignora este correo: tu contraseña no cambiará.",
                "",
                "Equipo CrowdRadar"
            ].join("\n"),
            html: `<p>Hola:</p>
<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta CrowdRadar.</p>
<p><a href="${escapeHtml(resetUrl)}">Restablecer contraseña</a></p>
<p>El enlace vence en 15 minutos y solo puede usarse una vez. Si no lo solicitaste, ignora este correo: tu contraseña no cambiará.</p>
<p>Equipo CrowdRadar</p>`
        }),
        sendPasswordChangedNotification: ({ email }) => send("aviso de cambio", {
            to: email,
            subject: "CrowdRadar: tu contraseña fue cambiada",
            text: [
                "Hola:",
                "",
                "La contraseña de tu cuenta CrowdRadar se restableció y se cerraron las sesiones abiertas.",
                "Si no fuiste tú, solicita un nuevo enlace de recuperación desde la aplicación.",
                "",
                "Equipo CrowdRadar"
            ].join("\n")
        })
    };
}

export function createSmtpRecoveryDelivery({ host, port, secure, user, password, from }) {
    // createTransport no conecta: la primera conexión ocurre al enviar.
    const transport = nodemailer.createTransport({
        host,
        port,
        secure,
        requireTLS: !secure,
        auth: { user, pass: password },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000
    });
    return createRecoveryMailDelivery({ sendMail: (message) => transport.sendMail(message), from });
}
