import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  async search<T>(query: string, data: T[], fields: (keyof T)[]): Promise<T[]> {
    const lowerQuery = query.toLowerCase();
    return data.filter((item) =>
      fields.some((field) =>
        String(item[field]).toLowerCase().includes(lowerQuery)
      )
    );
  }

  async fuzzySearch<T>(query: string, data: T[], fields: (keyof T)[]): Promise<T[]> {
    return this.search(query, data, fields);
  }

  buildSearchIndex<T>(data: T[], fields: (keyof T)[]): Map<string, T[]> {
    const index = new Map<string, T[]>();
    data.forEach((item) => {
      fields.forEach((field) => {
        const value = String(item[field]).toLowerCase();
        const tokens = value.split(/\s+/);
        tokens.forEach((token) => {
          if (!index.has(token)) index.set(token, []);
          index.get(token)!.push(item);
        });
      });
    });
    return index;
  }
}

export default SearchService;

