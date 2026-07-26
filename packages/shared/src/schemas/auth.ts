import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .max(128)
    .regex(/[a-zA-Z]/, 'Must include a letter')
    .regex(/[0-9]/, 'Must include a number'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const googleAuthSchema = z.object({
  /** Google ID token obtained client-side. */
  credential: z.string().min(20),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
