import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import policyController from '../controllers/policy.controller.js';

const router = express.Router();

router.use(authenticate);

// Auto-restore manual job trigger (guarded by manage_settings)
router.post(
  '/auto-restore/trigger',
  requirePermission('manage_settings'),
  policyController.triggerAutoRestoreSweep
);

export default router;
