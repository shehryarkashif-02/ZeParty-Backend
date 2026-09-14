import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import adminController from '../controllers/admin.controller.js';

const router = express.Router();

// Require authenticated Admin
router.use(authenticate);

// Admins Management Routes
router.get('/admins', requirePermission('view_admins'), adminController.getAdmins);
router.get('/admins/:id', requirePermission('view_admins'), adminController.getAdminById);
router.post('/admins', requirePermission('manage_admins'), adminController.createAdmin);
router.patch('/admins/:id', requirePermission('manage_admins'), adminController.updateAdmin);
router.patch('/admins/:id/status', requirePermission('manage_admins'), adminController.updateAdminStatus);
router.delete('/admins/:id', requirePermission('manage_admins'), adminController.deleteAdmin);

// Roles & Permissions Routes
router.get('/roles', requirePermission('view_admins'), adminController.getRoles);
router.post('/roles', requirePermission('manage_roles'), adminController.createRole);
router.patch('/roles/:id', requirePermission('manage_roles'), adminController.updateRole);

router.get('/permissions', requirePermission('view_admins'), adminController.getPermissions);
router.get('/admins/:id/permissions', requirePermission('view_admins'), adminController.getAdminPermissions);
router.put('/admins/:id/permissions', requirePermission('manage_roles'), adminController.updateAdminPermissions);

// Teams Routes
router.get('/teams', requirePermission('view_admins'), adminController.getTeams);
router.post('/teams', requirePermission('manage_admins'), adminController.createTeam);
router.put('/teams/:id', requirePermission('manage_admins'), adminController.updateTeam);
router.delete('/teams/:id', requirePermission('manage_admins'), adminController.deleteTeam);
router.post('/teams/:id/members', requirePermission('manage_admins'), adminController.addTeamMember);
router.delete('/teams/:id/members/:adminId', requirePermission('manage_admins'), adminController.removeTeamMember);

// Audit Logs Route
router.get('/audit-logs', requirePermission('view_audit_logs'), adminController.getAuditLogs);
router.get('/audit-logs/:id', requirePermission('view_audit_logs'), adminController.getAuditLogById);

export default router;


