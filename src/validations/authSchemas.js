// Texto con al menos dos caracteres visibles (ignorando espacios al inicio y al final).
export const visibleNamePattern = String.raw`^\s*\S.*\S\s*$`;
// Las columnas de texto de public.users son VARCHAR(255).
export const maxTextLength = 255;

export const registerSchema = {
    type: "object",
    properties: {
        nombre: { type: "string", minLength: 2, maxLength: maxTextLength, pattern: visibleNamePattern },
        apellido: { type: "string", minLength: 2, maxLength: maxTextLength, pattern: visibleNamePattern },
        email: { type: "string", format: "email", maxLength: maxTextLength },
        password: { type: "string", minLength: 8 },
        telefono: { type: "string", maxLength: maxTextLength },
        distrito: { type: "string", maxLength: maxTextLength }
    },
    required: ["nombre", "apellido", "email", "password"],
    additionalProperties: false
};

export const loginSchema = {
    type: "object",
    properties: {
        email: { type: "string", format: "email", maxLength: maxTextLength },
        password: { type: "string" }
    },
    required: ["email", "password"],
    additionalProperties: false
};
