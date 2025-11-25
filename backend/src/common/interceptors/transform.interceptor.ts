import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  statusCode: number;
  message?: string;
  data: T;
  timestamp: string;
}

/**
 * Transform interceptor to standardize API response format
 * Wraps all successful responses in a consistent structure
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => ({
        statusCode: response.statusCode,
        message: this.getMessage(data),
        data: this.transformData(data),
        timestamp: new Date().toISOString(),
      })),
    );
  }

  /**
   * Extract message from response data
   */
  private getMessage(data: any): string | undefined {
    if (data && typeof data === 'object' && 'message' in data) {
      return data.message;
    }
    return undefined;
  }

  /**
   * Transform response data
   * Remove message field if it exists as it's moved to top level
   */
  private transformData(data: any): any {
    if (data && typeof data === 'object' && 'message' in data) {
      const { message, ...rest } = data;
      return Object.keys(rest).length > 0 ? rest : data;
    }
    return data;
  }
}

