import { z } from 'zod';

/**
 * Validation schemas for form inputs using Zod
 * These schemas provide type-safe validation with helpful error messages
 */

// Email validation schema
export const emailSchema = z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address');

// Password validation schema with strength requirements
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be less than 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

// Simpler password schema for login (just min length)
export const loginPasswordSchema = z
    .string()
    .min(1, 'Password is required');

// Name validation schema
export const nameSchema = z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s\u00C0-\u024F]+$/, 'Name can only contain letters and spaces');

// Topic validation schema for deck creation
export const topicSchema = z
    .string()
    .min(3, 'Topic must be at least 3 characters')
    .max(200, 'Topic must be less than 200 characters')
    .refine(
        (val) => !/<[^>]*>/g.test(val),
        'Topic cannot contain HTML tags'
    );

// Number of questions validation
export const numQuestionsSchema = z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must have at least 1 question')
    .max(20, 'Maximum 20 questions per deck');

// Login form schema
export const loginFormSchema = z.object({
    email: emailSchema,
    password: loginPasswordSchema,
});

// Signup form schema
export const signupFormSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
});

// Create deck form schema
export const createDeckFormSchema = z.object({
    topic: topicSchema,
    numQuestions: numQuestionsSchema,
});

// Type exports for form data
export type LoginFormData = z.infer<typeof loginFormSchema>;
export type SignupFormData = z.infer<typeof signupFormSchema>;
export type CreateDeckFormData = z.infer<typeof createDeckFormSchema>;


// Helper function to validate a single field
export function validateField<T>(schema: z.ZodType<T>, value: unknown): { valid: boolean; error: string | null } {
    const result = schema.safeParse(value);
    return {
        valid: result.success,
        error: result.success ? null : result.error.issues[0]?.message || 'Invalid value',
    };
}
