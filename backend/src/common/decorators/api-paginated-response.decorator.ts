import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { applyDecorators, Type } from '@nestjs/common';

export class PaginatedDto<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

/**
 * Decorator for paginated API responses
 * Automatically generates OpenAPI schema for paginated responses
 */
export const ApiPaginatedResponse = <TModel extends Type<any>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description: 'Paginated response',
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              total: {
                type: 'number',
                description: 'Total number of items',
              },
              page: {
                type: 'number',
                description: 'Current page number',
              },
              limit: {
                type: 'number',
                description: 'Items per page',
              },
              totalPages: {
                type: 'number',
                description: 'Total number of pages',
              },
            },
          },
        ],
      },
    }),
  );
};

