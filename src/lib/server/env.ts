import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  APP_TIME_ZONE: z.string().default("America/Barbados"),
}).passthrough();

export const serverEnv = schema.parse(process.env);
