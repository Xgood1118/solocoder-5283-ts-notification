import { Router } from 'express';
import notificationsRouter from './routes/notifications';
import templatesRouter from './routes/templates';
import preferencesRouter from './routes/preferences';
import batchesRouter from './routes/batches';
import inappRouter from './routes/inapp';
import dashboardRouter from './routes/dashboard';
import metricsRouter from './routes/metrics';

const router = Router();

router.use('/notifications', notificationsRouter);
router.use('/templates', templatesRouter);
router.use('/preferences', preferencesRouter);
router.use('/batches', batchesRouter);
router.use('/in-app', inappRouter);
router.use('/dashboard', dashboardRouter);
router.use('/', metricsRouter);

export default router;
