export function requireOwner(req, res, next) {
  const isOwner = Boolean(req.admin?.isOwner || req.auth?.isOwner);
  if (!isOwner) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Reserved strictly for Owner principal.',
      error: { code: 'OWNER_PRIVILEGE_REQUIRED' },
    });
  }
  next();
}

export default requireOwner;
