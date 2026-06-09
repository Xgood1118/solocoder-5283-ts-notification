import { Template, NotificationCategory, TemplateEngine } from '../types';
import {
  createTemplate as dbCreateTemplate,
  updateTemplate as dbUpdateTemplate,
  getTemplateById as dbGetTemplateById,
  getTemplateByName as dbGetTemplateByName,
  listTemplates as dbListTemplates,
  deleteTemplate as dbDeleteTemplate,
  seedDefaultTemplates,
} from '../db/template.db';
import templateEngine from './engine';
import { config } from '../config';
import logger from '../utils/logger';

export class TemplateService {
  constructor() {}

  async createTemplate(data: {
    name: string;
    category: NotificationCategory;
    subject?: string;
    content: string;
    engine?: TemplateEngine;
  }): Promise<Template> {
    const engine = data.engine || config.templates.defaultEngine;

    if (!templateEngine.validateTemplate(data.content, engine)) {
      throw new Error('Invalid template syntax');
    }

    if (data.subject && !templateEngine.validateTemplate(data.subject, engine)) {
      throw new Error('Invalid subject template syntax');
    }

    return dbCreateTemplate({
      name: data.name,
      category: data.category,
      subject: data.subject,
      content: data.content,
      engine,
    });
  }

  async updateTemplate(
    id: string,
    updates: Partial<{ name: string; subject: string; content: string }>
  ): Promise<Template | null> {
    const existing = await this.getTemplateById(id);
    if (!existing) {
      return null;
    }

    if (updates.content && !templateEngine.validateTemplate(updates.content, existing.engine)) {
      throw new Error('Invalid template content syntax');
    }

    if (updates.subject && !templateEngine.validateTemplate(updates.subject, existing.engine)) {
      throw new Error('Invalid subject template syntax');
    }

    return dbUpdateTemplate(id, updates);
  }

  async getTemplateById(id: string): Promise<Template | null> {
    return dbGetTemplateById(id);
  }

  async getTemplateByName(name: string): Promise<Template | null> {
    return dbGetTemplateByName(name);
  }

  async listTemplates(
    category?: NotificationCategory,
    limit?: number,
    offset?: number
  ): Promise<Template[]> {
    return dbListTemplates(category, limit, offset);
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return dbDeleteTemplate(id);
  }

  async renderTemplate(
    templateId: string,
    data: Record<string, any>
  ): Promise<{ subject?: string; content: string }> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const subject = template.subject
      ? templateEngine.render(template.subject, data, template.engine)
      : undefined;

    const content = templateEngine.render(template.content, data, template.engine);

    return { subject, content };
  }

  async seedDefaults(): Promise<void> {
    await seedDefaultTemplates();
  }
}

const templateService = new TemplateService();

export default templateService;
