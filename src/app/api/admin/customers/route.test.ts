import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  deleteUser: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: mocks.requireRole,
  toErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'auth failed';
    return Response.json({ error: message }, { status: 403 });
  }),
}));

vi.mock('@/lib/flows/admin-client', () => ({
  supabaseAdmin: () => ({
    auth: { admin: { deleteUser: mocks.deleteUser } },
    from: mocks.from,
  }),
}));

import { DELETE } from './route';

function request(body: unknown) {
  return new Request('http://localhost/api/admin/customers', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ctx = {
  supabase: { from: vi.fn() },
  accountId: 'account-1',
  userId: 'admin-1',
  role: 'admin',
};

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  mocks.requireRole.mockReset();
  mocks.deleteUser.mockReset();
  mocks.from.mockReset();
  mocks.requireRole.mockResolvedValue(ctx);
  mocks.from.mockReturnValue({
    insert: mocks.insert,
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  });
});

describe('/api/admin/customers DELETE', () => {
  it('rejects deleting the protected customer code CUS-0147E2A1', async () => {
    ctx.supabase.from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { user_id: 'user-2', account_role: 'agent', customer_code: 'CUS-0147E2A1' },
            }),
          }),
        }),
      }),
    }));

    const response = await DELETE(request({ userId: 'user-2' }));

    expect(response.status).toBe(400);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('allows deleting other customers', async () => {
    ctx.supabase.from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { user_id: 'user-3', account_role: 'agent', customer_code: 'CUS-9999ZZZ' },
            }),
          }),
        }),
      }),
    }));
    mocks.deleteUser.mockResolvedValue({ error: null });

    const response = await DELETE(request({ userId: 'user-3' }));

    expect(response.status).toBe(200);
    expect(mocks.deleteUser).toHaveBeenCalledWith('user-3');
  });
});
