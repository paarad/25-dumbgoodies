import { z } from "zod";

export const ProposeRequestSchema = z.object({
	brand: z.string().min(1),
	logoUrl: z.string().url().optional(),
});

export const ConceptSchema = z.object({
	id: z.string(),
	label: z.string(),
	prompt_base: z.string(),
});

export const ProposeResponseSchema = z.object({
	concepts: z.array(ConceptSchema).length(2),
});

export const RenderRequestSchema = z.object({
	projectId: z.string().uuid(),
	conceptId: z.string().uuid(),
	brand: z.string().min(1),
	logoUrl: z.string().url().optional(),
	productRefUrl: z.string().url().optional(),
	promptBase: z.string().min(1),
});

export const RenderResultSchema = z.object({
	model: z.enum(["v1-seedream", "v1_5-openai"]),
	imageUrl: z.string().url(),
	thumbnailUrl: z.string().url(),
});

export const RenderResponseSchema = z.object({
	results: z.array(RenderResultSchema).min(1),
});

export const SaveRequestSchema = z.object({
	projectId: z.string().uuid(),
	conceptId: z.string().uuid(),
	model: z.string(),
	imageUrl: z.string().url(),
	thumbnailUrl: z.string().url().optional(),
});

export type ProposeRequest = z.infer<typeof ProposeRequestSchema>;
export type ProposeResponse = z.infer<typeof ProposeResponseSchema>;
export type RenderRequest = z.infer<typeof RenderRequestSchema>;
export type RenderResponse = z.infer<typeof RenderResponseSchema>;
export type SaveRequest = z.infer<typeof SaveRequestSchema>; 