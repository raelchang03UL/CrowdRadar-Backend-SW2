export const saturationReportSchema = {
    type: "object",
    properties: {
        level: {
            type: "string",
            enum: ["TRANQUILO", "MODERADO", "SATURADO"]
        }
    },
    required: ["level"],
    additionalProperties: false
};
