import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  async exportToCSV(data: any[]): Promise<string> {
    if (!data.length) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) => Object.values(row).join(','));
    return [headers, ...rows].join('\n');
  }

  async exportToJSON(data: any[]): Promise<string> {
    return JSON.stringify(data, null, 2);
  }

  async exportToXML(data: any[]): Promise<string> {
    const items = data.map((item) => {
      const props = Object.entries(item)
        .map(([key, value]) => `<${key}>${value}</${key}>`)
        .join('');
      return `<item>${props}</item>`;
    });
    return `<?xml version="1.0"?><data>${items.join('')}</data>`;
  }

  async generateReport(data: any[], format: 'csv' | 'json' | 'xml'): Promise<string> {
    switch (format) {
      case 'csv':
        return this.exportToCSV(data);
      case 'json':
        return this.exportToJSON(data);
      case 'xml':
        return this.exportToXML(data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
}

export default ExportService;

