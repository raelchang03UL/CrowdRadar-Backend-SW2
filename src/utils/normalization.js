// Normalización compartida de datos de cuenta. El correo se compara sin
// mayúsculas ni espacios, igual que la recuperación de contraseña
// (PasswordRecoveryRepository usa LOWER(BTRIM(email))).
export function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : value;
}

export function normalizeText(value) {
    return typeof value === "string" ? value.trim() : value;
}

// Devuelve una copia con los campos de texto indicados sin espacios sobrantes.
export function trimFields(data, fields) {
    const copy = { ...data };
    for (const field of fields) {
        if (field in copy) copy[field] = normalizeText(copy[field]);
    }
    return copy;
}
