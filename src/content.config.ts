// Content layer configuration for Astro content collections
import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
  type: 'content_layer',
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = {
  docs,
};
