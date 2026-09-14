# OWNER / ROOT ADMIN ARCHITECTURE & SECURITY SPECIFICATION

## Executive Overview
The **Owner** (Root Admin) is the highest authority principal in the ZeParty system, positioned above Super Admin. The Owner is designed as a hidden, silent, root-level administrative entity capable of controlling every aspect of system administration, including Super Admin permissions, module-level visibility, direct operation grants/revocations, and approval authority.

---

## 1. Administrative Hierarchy
```
                   OWNER (Root Authority — Hidden)
                      │
        ┌─────────────┴─────────────┐
        │                           │
   SUPER ADMIN                 OWNER CONTROL
   (Normal Admin Head)         (Root Configuration)
        │
   OTHER ADMIN ROLES
   (Finance, Host, Agency, Reseller, Moderator, etc.)
```

---

## 2. Security & Invisibility Guarantees

### Unified Authentication & Invisibility Enforcement
- **Invisibility Enforcement**: Standard database repositories (`adminRepository.findAll`, search endpoints, audit logs, dropdowns, and team queries) filter out Owner records (`where: { isOwner: false }`).
- **Unified Authentication**: Owner authenticates via the standard `POST /api/v1/auth/admin/login` endpoint. Upon successful authentication, the token and session carry `isOwner: true`.
- **Super Admin Boundary**: Super Admins cannot discover, view, edit, suspend, delete, or revoke privileges of the Owner. Super Admins cannot set `isOwner: true` on any account.
- **Middleware Guard**: Owner endpoints (`/api/v1/owner/*`) are protected by `requireOwner` middleware which checks `req.admin.isOwner === true || req.auth.isOwner === true` and rejects non-Owner callers with `403 Forbidden`.

---

## 3. Two-Level Access Control Model

### Level 1: Module Access
Controls top-level sidebar navigation items and route access. Administrators only see and can access modules explicitly granted to them (`AdminModuleAccess`).
Supported modules include all system modules in `ALL_SYSTEM_MODULES`.

### Level 2: Action Permissions
Calculated dynamically by `effectivePermissionsService`:
`Effective Permissions = Role Permissions + Direct Overrides (AdminPermissionOverride) + Owner Direct Grants (OwnerGrant) - Explicit Revocations`

---

## 4. Database Schema Extensions

### Admin Model Additions
```prisma
model Admin {
  id                  String                      @id @default(uuid())
  ...
  isOwner             Boolean                     @default(false)
  moduleAccess        AdminModuleAccess[]
  ownerGrants         OwnerGrant[]
  permissionOverrides AdminPermissionOverride[]
  
  @@index([isOwner])
}
```

### Module Access Model (`AdminModuleAccess`)
```prisma
model AdminModuleAccess {
  id        String   @id @default(uuid())
  adminId   String
  module    String
  grantedBy String
  grantedAt DateTime @default(now())

  @@unique([adminId, module])
}
```

### Owner Grant Model (`OwnerGrant`)
```prisma
model OwnerGrant {
  id           String    @id @default(uuid())
  adminId      String
  grantType    String    // "MODULE", "PERMISSION_GRANT", "PERMISSION_REVOKE", "APPROVAL_AUTHORITY"
  module       String?
  permissionId String?
  canApprove   Boolean   @default(false)
  grantedBy    String
  grantedAt    DateTime  @default(now())
  status       String    @default("ACTIVE")
  reason       String?
}
```

---

## 5. API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/admin/login` | Unified Administrator & Owner Authentication (returns `isOwner: true`) |

### Protected Owner Governance Endpoints (`/api/v1/owner/*`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/owner/admins` | List all administrators (including Super Admin) |
| `POST` | `/api/v1/owner/admins` | Create new administrator / Super Admin |
| `PUT` | `/api/v1/owner/admins/:id` | Update admin status/role/SuperAdmin flag |
| `POST` | `/api/v1/owner/admins/:id/modules` | Assign module access list |
| `POST` | `/api/v1/owner/admins/:id/permissions/grant` | Grant direct action permission |
| `POST` | `/api/v1/owner/admins/:id/permissions/revoke` | Explicitly revoke permission |
| `POST` | `/api/v1/owner/admins/:id/approval-authority` | Configure financial approval authority |
| `GET` | `/api/v1/owner/audit-logs` | Retrieve full Owner governance audit trail |

---

## 6. Audit Trail & Financial Safety
- **Immutable Ledger**: All financial actions retain `WalletLedger` auditability.
- **Owner Action Auditing**: Every Owner governance action emits `OWNER_*` events into `AuditLog`.
- **Sanitized Audit Output**: Normal admin audit log queries omit Owner's identifying information.
