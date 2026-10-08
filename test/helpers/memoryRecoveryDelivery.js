// Exclusivo de pruebas: nunca se importa en src/ ni en el arranque normal.
export function createMemoryRecoveryDelivery() {
    const messages = [];
    return {
        messages,
        delivery: {
            sendResetLink: async ({ email, resetUrl }) => { messages.push({ type: "reset-link", email, resetUrl }); },
            sendPasswordChangedNotification: async ({ email }) => { messages.push({ type: "password-changed", email }); }
        }
    };
}
