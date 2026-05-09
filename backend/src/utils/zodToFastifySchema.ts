import { z } from "zod";

export const zodToFastifySchema = (schema: z.ZodTypeAny): Record<string, unknown> => {
  const jsonSchema = schema.toJSONSchema();
  const schemaWithoutMeta = { ...jsonSchema };
  delete schemaWithoutMeta.$schema;
  return schemaWithoutMeta as Record<string, unknown>;
};
