import express from 'express';
import ownerController from '../controllers/owner.controller.js';
import authenticate from '../middlewares/authenticate.js';
import requireOwner from '../middlewares/requireOwner.js';

const router = express.Router();

// Protected Owner Governance Endpoints (Requires valid Auth Token AND isOwner === true)
router.use(authenticate);
router.use(requireOwner);

router.get('/admins', ownerController.getAdministrators);
router.post('/admins', ownerController.createAdministrator);
router.put('/admins/:id', ownerController.updateAdministrator);
router.post('/admins/:id/modules', ownerController.setModuleAccess);
router.post('/admins/:id/permissions/grant', ownerController.grantPermission);
router.post('/admins/:id/permissions/revoke', ownerController.revokePermission);
router.post('/admins/:id/approval-authority', ownerController.setApprovalAuthority);
router.get('/admins/:id/effective-permissions', ownerController.getEffectivePermissionsForAdmin);

router.get('/audit-logs', ownerController.getAuditLogs);

export default router;
