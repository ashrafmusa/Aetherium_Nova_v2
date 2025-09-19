// src/utils/cliUtils.ts (Corrected)
import chalk from 'chalk';
import { ZodError, ZodIssue } from 'zod';
import logger from '../logger.js';

// Helper to log errors consistently, especially from API responses or Zod validation
export function logApiError(prefix: string, error: any): void {
    if (error instanceof ZodError) {
        // Handle Zod validation errors (e.g., from backend API)
        const zodError = error as ZodError;
        logger.error(`${chalk.red(prefix)} Validation failed:`);
        zodError.issues.forEach((issue: ZodIssue) => {
            logger.error(chalk.yellow(`  - ${issue.path.join('.')} (${issue.code}): ${issue.message}`));
        });
        return;
    }
    if (error?.response) {
        // Axios error with a response from the server
        logger.error(chalk.red(`${prefix} API Error (Status: ${error.response.status}):`), error.response.data);
    } else if (error?.request) {
        // Axios error where the request was made but no response was received (e.g., network down)
        logger.error(chalk.red(`${prefix} Network Error: No response from server. Is the node running at expected port?`));
    } else {
        // Generic JavaScript error
        logger.error(chalk.red(`${prefix} Unexpected Error:`), error.message || String(error));
    }
}

// This function is defined here for use in CLI command files
export function getApiErrorMessage(error: any): string {
    if (error.response) {
        const { data, status } = error.response;
        if (data && data.error) {
            if (typeof data.error === 'string') {
                return data.error;
            }
            if (data.error.message) {
                return data.error.message;
            }
        }
        if (data && data.details && Array.isArray(data.details)) {
            return data.details.map((detail: any) => detail.message).join('; ');
        }
        return `Server Error (${status}): ${data.message || JSON.stringify(data)}`;
    } else if (error.request) {
        return `Network Error: Could not connect to the node. Is it running?`;
    } else {
        return `Request Error: ${error.message}`;
    }
}

// Basic input validation helpers
export function validateAddress(address: string, name: string = "Address"): string | true {
    if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length !== 42) {
        return `${name} must be a 42-character hexadecimal string starting with '0x'.`;
    }
    return true;
}

export function validateAmountFee(value: number, name: string = "Value", min: number = 0): string | true {
    if (isNaN(value) || value < min) {
        return `${name} must be a number and at least ${min}.`;
    }
    return true;
}