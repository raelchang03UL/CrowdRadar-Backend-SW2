import { maxTextLength, visibleNamePattern } from "./authSchemas.js";

export const updateUserSchema = {
    type: "object",
    properties: {
        nombre: { type: "string", minLength: 2, maxLength: maxTextLength, pattern: visibleNamePattern },
        apellido: { type: "string", minLength: 2, maxLength: maxTextLength, pattern: visibleNamePattern },
        telefono: { type: "string", maxLength: maxTextLength },
        distrito: { type: "string", maxLength: maxTextLength }
    },
    // Un PUT sin campos no actualiza nada: se informa como dato inválido.
    minProperties: 1,
    additionalProperties: false
};
