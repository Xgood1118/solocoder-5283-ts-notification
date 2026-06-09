import * as Handlebars from 'handlebars';
import { Template, TemplateSnapshot, TemplateEngine } from '../types';
import logger from '../utils/logger';

export interface RenderOptions {
  strict?: boolean;
}

class TemplateEngineService {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerDefaultHelpers();
  }

  private registerDefaultHelpers(): void {
    this.handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    this.handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    this.handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    this.handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    this.handlebars.registerHelper('and', (a: any, b: any) => a && b);
    this.handlebars.registerHelper('or', (a: any, b: any) => a || b);
    this.handlebars.registerHelper('not', (a: any) => !a);
    this.handlebars.registerHelper('formatDate', (date: string | Date, format?: string) => {
      const d = new Date(date);
      return d.toLocaleString('zh-CN');
    });
    this.handlebars.registerHelper('truncate', (text: string, length: number) => {
      if (text.length <= length) return text;
      return text.substring(0, length) + '...';
    });
  }

  render(template: string, data: Record<string, any>, engine: TemplateEngine = 'handlebars'): string {
    if (engine !== 'handlebars') {
      throw new Error(`Unsupported template engine: ${engine}`);
    }

    try {
      const compiled = this.handlebars.compile(template, {
        strict: false,
        noEscape: false,
      });
      const result = compiled(data);
      return result;
    } catch (error) {
      logger.error('Template render error', { error, template });
      throw new Error(`Template render failed: ${(error as Error).message}`);
    }
  }

  renderSubject(template: Template, data: Record<string, any>): string | undefined {
    if (!template.subject) {
      return undefined;
    }
    return this.render(template.subject, data, template.engine);
  }

  renderContent(template: Template, data: Record<string, any>): string {
    return this.render(template.content, data, template.engine);
  }

  createSnapshot(template: Template, data: Record<string, any>): TemplateSnapshot {
    const renderedSubject = this.renderSubject(template, data);
    const renderedContent = this.renderContent(template, data);

    return {
      template_id: template.id,
      template_name: template.name,
      template_version: template.version,
      subject: template.subject,
      content: template.content,
      rendered_subject: renderedSubject,
      rendered_content: renderedContent,
      engine: template.engine,
    };
  }

  validateTemplate(content: string, engine: TemplateEngine = 'handlebars'): boolean {
    try {
      this.handlebars.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  registerPartial(name: string, template: string): void {
    this.handlebars.registerPartial(name, template);
    logger.debug(`Registered partial: ${name}`);
  }

  registerHelper(name: string, fn: (...args: any[]) => any): void {
    this.handlebars.registerHelper(name, fn);
    logger.debug(`Registered helper: ${name}`);
  }
}

const templateEngine = new TemplateEngineService();

export default templateEngine;
export { TemplateEngineService };
