import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import policyController from '../controllers/policy.controller.js';

const router = express.Router();

router.use(authenticate);

// --- Dynamic Economy Configuration Key-Values & 15-Day Auto-Restore ---
router.get('/configs', requirePermission('view_settings'), policyController.getConfigurations);
router.get('/configs/:key', requirePermission('view_settings'), policyController.getEffectiveConfig);
router.put('/configs/:key', requirePermission('economy_settings'), policyController.updateConfiguration);
router.post('/configs/:key/disable', requirePermission('economy_settings'), policyController.disableConfiguration);
router.post('/configs/:key/restore', requirePermission('economy_settings'), policyController.restoreConfiguration);

export default router;
