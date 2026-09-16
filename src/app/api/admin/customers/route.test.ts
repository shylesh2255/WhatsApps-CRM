import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePlatformOwner: vi.fn(),
  deleteUser: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requirePlatformOwner: mocks.requirePlatformOwner,
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

function mockTarget(target: { user_id: string; account_role: string; customer_code: string } | null) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: target }),
          }),
        }),
      };
    }
    return { insert: mocks.insert };
  });
}

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  mocks.requirePlatformOwner.mockReset();
  mocks.deleteUser.mockReset();
  mocks.from.mockReset();
  mocks.insert.mockReset();
  mocks.requirePlatformOwner.mockResolvedValue(ctx);
  mocks.insert.mockResolvedValue({ error: null });
});

describe('/api/admin/customers DELETE', () => {
  it('rejects deleting the protected customer code CUS-0147E2A1', async () => {
    mockTarget({ user_id: 'user-2', account_role: 'agent', customer_code: 'CUS-0147E2A1' });

    const response = await DELETE(request({ userId: 'user-2' }));

    expect(response.status).toBe(400);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('allows deleting other customers', async () => {
    mockTarget({ user_id: 'user-3', account_role: 'agent', customer_code: 'CUS-9999ZZZ' });
    mocks.deleteUser.mockResolvedValue({ error: null });

    const response = await DELETE(request({ userId: 'user-3' }));

    expect(response.status).toBe(200);
    expect(mocks.deleteUser).toHaveBeenCalledWith('user-3');
  });

  it('rejects a caller who is not the platform owner', async () => {
    mocks.requirePlatformOwner.mockRejectedValue(new Error('This action is restricted to the platform administrator'));

    const response = await DELETE(request({ userId: 'user-3' }));

    expect(response.status).toBe(403);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});
