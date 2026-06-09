import { Router, Request, Response } from 'express';
import templateService from '../../templates/service';
import { NotificationCategory, TemplateEngine } from '../../types';
import logger from '../../utils/logger';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, category, subject, content, engine } = req.body;

    if (!name || !category || !content) {
      return res.status(400).json({
        error: 'Missing required fields: name, category, content',
      });
    }

    const template = await templateService.createTemplate({
      name,
      category: category as NotificationCategory,
      subject,
      content,
      engine: engine as TemplateEngine,
    });

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Create template failed', { error });
    res.status(400).json({
      error: (error as Error).message,
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await templateService.getTemplateById(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Get template failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.get('/name/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const template = await templateService.getTemplateByName(name);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Get template by name failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, limit = '100', offset = '0' } = req.query;

    const templates = await templateService.listTemplates(
      category as NotificationCategory,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    logger.error('List templates failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, subject, content } = req.body;

    const template = await templateService.updateTemplate(id, { name, subject, content });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Update template failed', { error });
    res.status(400).json({
      error: (error as Error).message,
    });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await templateService.deleteTemplate(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      message: 'Template deleted',
    });
  } catch (error) {
    logger.error('Delete template failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.post('/:id/render', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body.data || {};

    const result = await templateService.renderTemplate(id, data);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Render template failed', { error });
    res.status(400).json({
      error: (error as Error).message,
    });
  }
});

export default router;
