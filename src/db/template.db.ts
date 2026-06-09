import { getDb, saveDb } from './index';
import { Template, NotificationCategory, TemplateEngine } from '../types';
import { generateSnowflakeId } from '../utils/snowflake';
import logger from '../utils/logger';

export async function createTemplate(template: Omit<Template, 'id' | 'version' | 'created_at' | 'updated_at' | 'is_active'>): Promise<Template> {
  const db = await getDb();
  const id = generateSnowflakeId();
  const now = new Date().toISOString();
  const version = 1;

  const stmt = db.prepare(`
    INSERT INTO templates (id, name, category, subject, content, engine, version, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  stmt.run(id, template.name, template.category, template.subject || null, template.content, template.engine, version, now, now);
  saveDb();

  const result = await getTemplateById(id);
  return result as Template;
}

export async function updateTemplate(id: string, updates: Partial<Pick<Template, 'name' | 'subject' | 'content'>>): Promise<Template | null> {
  const db = await getDb();
  const existing = await getTemplateById(id);
  if (!existing) {
    return null;
  }

  const newVersion = existing.version + 1;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE templates 
    SET name = ?, subject = ?, content = ?, version = ?, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(
    updates.name || existing.name,
    updates.subject !== undefined ? updates.subject : existing.subject,
    updates.content || existing.content,
    newVersion,
    now,
    id
  );
  saveDb();

  logger.info(`Template ${id} updated to version ${newVersion}`);
  return getTemplateById(id);
}

export async function getTemplateById(id: string): Promise<Template | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM templates WHERE id = ?');
  const result = stmt.getAsObject(id) as Template | undefined;
  return result || null;
}

export async function getTemplateByName(name: string): Promise<Template | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM templates WHERE name = ? AND is_active = 1 ORDER BY version DESC LIMIT 1');
  const result = stmt.getAsObject(name) as Template | undefined;
  return result || null;
}

export async function listTemplates(category?: NotificationCategory, limit: number = 100, offset: number = 0): Promise<Template[]> {
  const db = await getDb();
  let query = 'SELECT * FROM templates WHERE is_active = 1';
  const params: any[] = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  const results = stmt.getAsObject(...params);
  return Array.isArray(results) ? results : [];
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const db = await getDb();
  const stmt = db.prepare('UPDATE templates SET is_active = 0, updated_at = ? WHERE id = ?');
  const info = stmt.run(new Date().toISOString(), id);
  saveDb();
  return info.changes > 0;
}

export async function seedDefaultTemplates(): Promise<void> {
  const existing = await listTemplates(undefined, 1, 0);
  
  if (existing.length > 0) {
    logger.info('Templates already seeded, skipping');
    return;
  }

  const templates = [
    {
      name: 'order_created',
      category: 'order' as NotificationCategory,
      subject: '订单创建成功 - 订单号 {{orderId}}',
      content: `<p>尊敬的 {{username}}，</p><p>您的订单已创建成功，订单号：<strong>{{orderId}}</strong></p><p>订单金额：¥{{amount}}</p><p>感谢您的购买！</p>`,
    },
    {
      name: 'password_reset',
      category: 'password_reset' as NotificationCategory,
      subject: '密码重置请求',
      content: `<p>您好 {{username}}，</p><p>您正在请求重置密码，请点击以下链接：</p><p><a href="{{resetUrl}}">{{resetUrl}}</a></p><p>如果不是您本人操作，请忽略此邮件。</p>`,
    },
    {
      name: 'system_alert',
      category: 'alert' as NotificationCategory,
      subject: '【系统告警】{{alertLevel}} - {{alertTitle}}',
      content: `<h3>系统告警通知</h3><p>级别：{{alertLevel}}</p><p>标题：{{alertTitle}}</p><p>描述：{{description}}</p><p>时间：{{timestamp}}</p><p>请及时处理。</p>`,
    },
    {
      name: 'marketing_promotion',
      category: 'marketing' as NotificationCategory,
      subject: '🎉 限时优惠 - {{promotionTitle}}',
      content: `<div style="text-align: center;"><h2>{{promotionTitle}}</h2><p>{{description}}</p><p>优惠码：<strong>{{couponCode}}</strong></p><p>有效期至：{{expireDate}}</p></div>`,
    },
    {
      name: 'in_app_system',
      category: 'system' as NotificationCategory,
      subject: '系统通知',
      content: '{{message}}',
    },
  ];

  for (const tpl of templates) {
    await createTemplate({
      ...tpl,
      engine: 'handlebars' as TemplateEngine,
    });
  }

  logger.info(`Seeded ${templates.length} default templates`);
}

export default {
  createTemplate,
  updateTemplate,
  getTemplateById,
  getTemplateByName,
  listTemplates,
  deleteTemplate,
  seedDefaultTemplates,
};
