import { Injectable, BadRequestException } from '@nestjs/common';
import { isAddress } from 'ethers/lib/utils';

export interface ValidationRule {
  field: string;
  rules: string[];
  customMessage?: string;
}

@Injectable()
export class ValidationService {
  /**
   * Validate Ethereum address
   */
  isEthereumAddress(address: string): boolean {
    try {
      return isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Validate email
   */
  isEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL
   */
  isURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate string length
   */
  validateLength(
    value: string,
    min?: number,
    max?: number
  ): { valid: boolean; error?: string } {
    if (min !== undefined && value.length < min) {
      return { valid: false, error: `Minimum length is ${min}` };
    }

    if (max !== undefined && value.length > max) {
      return { valid: false, error: `Maximum length is ${max}` };
    }

    return { valid: true };
  }

  /**
   * Validate required field
   */
  isRequired(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string' && value.trim() === '') {
      return false;
    }

    return true;
  }

  /**
   * Validate number range
   */
  isInRange(value: number, min?: number, max?: number): boolean {
    if (min !== undefined && value < min) {
      return false;
    }

    if (max !== undefined && value > max) {
      return false;
    }

    return true;
  }

  /**
   * Validate date
   */
  isValidDate(date: any): boolean {
    const d = new Date(date);
    return !isNaN(d.getTime());
  }

  /**
   * Validate date range
   */
  isDateAfter(date: Date, compareDate: Date): boolean {
    return date.getTime() > compareDate.getTime();
  }

  /**
   * Validate date before
   */
  isDateBefore(date: Date, compareDate: Date): boolean {
    return date.getTime() < compareDate.getTime();
  }

  /**
   * Validate alphanumeric
   */
  isAlphanumeric(value: string): boolean {
    return /^[a-zA-Z0-9]+$/.test(value);
  }

  /**
   * Validate numeric
   */
  isNumeric(value: string): boolean {
    return /^\d+$/.test(value);
  }

  /**
   * Validate object
   */
  validateObject(
    obj: Record<string, any>,
    rules: ValidationRule[]
  ): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const rule of rules) {
      const value = obj[rule.field];

      for (const ruleType of rule.rules) {
        const [ruleName, ...params] = ruleType.split(':');

        let isValid = true;
        let errorMessage = '';

        switch (ruleName) {
          case 'required':
            isValid = this.isRequired(value);
            errorMessage = `${rule.field} is required`;
            break;

          case 'email':
            isValid = this.isEmail(value);
            errorMessage = `${rule.field} must be a valid email`;
            break;

          case 'url':
            isValid = this.isURL(value);
            errorMessage = `${rule.field} must be a valid URL`;
            break;

          case 'address':
            isValid = this.isEthereumAddress(value);
            errorMessage = `${rule.field} must be a valid Ethereum address`;
            break;

          case 'min':
            if (typeof value === 'string') {
              isValid = value.length >= parseInt(params[0]);
              errorMessage = `${rule.field} must be at least ${params[0]} characters`;
            } else if (typeof value === 'number') {
              isValid = value >= parseFloat(params[0]);
              errorMessage = `${rule.field} must be at least ${params[0]}`;
            }
            break;

          case 'max':
            if (typeof value === 'string') {
              isValid = value.length <= parseInt(params[0]);
              errorMessage = `${rule.field} must be at most ${params[0]} characters`;
            } else if (typeof value === 'number') {
              isValid = value <= parseFloat(params[0]);
              errorMessage = `${rule.field} must be at most ${params[0]}`;
            }
            break;

          case 'numeric':
            isValid = this.isNumeric(value);
            errorMessage = `${rule.field} must be numeric`;
            break;

          case 'alphanumeric':
            isValid = this.isAlphanumeric(value);
            errorMessage = `${rule.field} must be alphanumeric`;
            break;
        }

        if (!isValid) {
          errors[rule.field] = rule.customMessage || errorMessage;
          break;
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validate and throw
   */
  validateOrThrow(
    obj: Record<string, any>,
    rules: ValidationRule[]
  ): void {
    const result = this.validateObject(obj, rules);

    if (!result.valid) {
      const errorMessages = Object.entries(result.errors)
        .map(([field, error]) => `${field}: ${error}`)
        .join(', ');

      throw new BadRequestException(errorMessages);
    }
  }

  /**
   * Sanitize string
   */
  sanitizeString(value: string): string {
    return value.trim().replace(/[<>]/g, '');
  }

  /**
   * Sanitize object
   */
  sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export default ValidationService;

