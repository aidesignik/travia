import { z } from "zod";

export const NOTE_TITLE_MAX = 200;
export const NOTE_BODY_MAX = 20000;

export const noteSchema = z.object({
  title: z.string().max(NOTE_TITLE_MAX).optional(),
  body: z.string().max(NOTE_BODY_MAX).optional(),
});
