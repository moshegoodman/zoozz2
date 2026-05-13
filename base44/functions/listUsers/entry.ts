import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow platform admins OR app-level admin/chief of staff users
    const userType = (user.user_type || '').trim().toLowerCase().replace(/[_\s]+/g, ' ');
    const isAllowed = user.role === 'admin' || userType === 'admin' || userType === 'chief of staff';

    if (!isAllowed) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
    return Response.json({ users });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});