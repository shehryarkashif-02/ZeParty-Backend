import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import requireOwner from '../middlewares/requireOwner.js';
import policyController from '../controllers/policy.controller.js';

const router = express.Router();

router.use(authenticate);

// --- Master Policies & Versions ---
router.get('/', requirePermission('view_settings'), policyController.getPolicies);
router.get('/effective/:policyType', requirePermission('view_settings'), policyController.getEffectivePolicy);
router.get('/:id', requirePermission('view_settings'), policyController.getPolicyById);
router.post('/', requirePermission('economy_settings'), policyController.createPolicy);

router.get('/:id/versions', requirePermission('view_settings'), policyController.getVersions);
router.post('/:id/versions', requirePermission('economy_settings'), policyController.createVersion);
router.post('/:id/versions/:versionId/publish', requirePermission('economy_settings'), policyController.publishVersion);
router.post('/:id/rollback', requirePermission('economy_settings'), policyController.rollbackPolicy);

export default router;
