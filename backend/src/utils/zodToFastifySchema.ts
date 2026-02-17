import { z } from "zod"

export const zodToFastifySchema = (schema: z.ZodTypeAny): Record<string, unknown> => {
    const jsonSchema = schema.toJSONSchema()
    const { $schema, ...schemaWithoutMeta } = jsonSchema
    return schemaWithoutMeta as Record<string, unknown>
}
