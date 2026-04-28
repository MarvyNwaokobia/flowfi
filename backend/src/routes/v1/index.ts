import { Router } from 'express';
import streamRoutes from './stream.routes.js';
import eventsRoutes from './events.routes.js';
import userRoutes from './user.routes.js';
import authRoutes from './auth.routes.js';
import v1AdminRoutes from './admin.routes.js';
import adminMetricsRoutes from '../adminRoutes.js';

const router = Router();

// V1 API Routes
router.use('/streams', streamRoutes);
router.use('/events', eventsRoutes);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/admin', v1AdminRoutes);
router.use('/admin', adminMetricsRoutes);

export default router;
