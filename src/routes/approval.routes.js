import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import idempotencyMiddleware from '../middlewares/idempotency.js';
import approvalController from '../controllers/approval.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('view_admins'), approvalController.getApprovals);
router.get('/:id', requirePermission('view_admins'), approvalController.getApprovalById);
router.post('/:id/approve', idempotencyMiddleware, approvalController.approveRequest);
router.post('/:id/reject', idempotencyMiddleware, approvalController.rejectRequest);

export default router;
