/**
 * Shared retry utility with exponential backoff
 * Consolidates retry logic from aiService.ts and fileService.ts
 */

// Retry configuration
export const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
};

// Helper function to delay execution
export const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

function getHttpStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object') return null;

    const errorRecord = error as Record<string, unknown>;
    if (typeof errorRecord.status === 'number') {
        return errorRecord.status;
    }

    const context = errorRecord.context;
    if (context instanceof Response) {
        return context.status;
    }

    return null;
}

// Retry only transient failures. Validation, auth, permission and payload
// errors from the Edge Function must fail immediately.
export function isRetryableError(error: unknown): boolean {
    const status = getHttpStatus(error);
    if (status !== null) {
        return [408, 500, 502, 503, 504].includes(status);
    }

    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        const name = error.name.toLowerCase();
        return (
            message.includes('network') ||
            message.includes('timeout') ||
            name.includes('fetcherror') ||
            name.includes('relayerror')
        );
    }
    return false;
}

// Generic retry wrapper for async functions with exponential backoff
export async function withRetry<T>(
    fn: () => Promise<T>,
    operationName: string
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (!isRetryableError(error) || attempt === RETRY_CONFIG.maxRetries) {
                throw error;
            }

            const backoffDelay = Math.min(
                RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
                RETRY_CONFIG.maxDelay
            );

            console.warn(
                `${operationName} failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}). Retrying in ${Math.round(backoffDelay)}ms...`,
                error instanceof Error ? error.message : error
            );

            await delay(backoffDelay);
        }
    }

    throw lastError;
}
