import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  listUsers: vi.fn(),
  from: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
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
    auth: {
      admin: {
        listUsers: mocks.listUsers,
        updateUserById: mocks.updateUserById,
        deleteUser: mocks.deleteUser,
      },
    },
    from: mocks.from,
  }),
}));

import { DELETE, GET, PATCH } from './route';

const ctx = {
  supabase: { from: vi.fn() },
  accountId: 'account-1',
  userId: 'admin-1',
  role: 'admin',
};

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  mocks.requireRole.mockReset();
  mocks.listUsers.mockReset();
  mocks.from.mockReset();
  mocks.updateUserById.mockReset();
  mocks.deleteUser.mockReset();
  ctx.supabase.from = vi.fn();
  mocks.from.mockImplementation((table: string) => ({
    update: () => ({
      eq: () => ({
        eq: () => ({
          then: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    insert: () => ({
      then: async () => ({ data: null, error: null }),
    }),
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { user_id: 'user-1', account_role: 'admin' }, error: null }),
        }),
      }),
    }),
  }));
  mocks.requireRole.mockResolvedValue(ctx);
});

describe('/api/admin/users', () => {
  it('returns safe user data without exposing the password hash', async () => {
    mocks.listUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-1',
            email: 'mshylesh.it@gmail.com',
            created_at: '2024-01-01T00:00:00Z',
            last_sign_in_at: '2024-02-02T00:00:00Z',
            user_metadata: { full_name: 'Shylesh' },
            app_metadata: { provider: 'email' },
          },
        ],
      },
      error: null,
    });
    ctx.supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [
              {
                user_id: 'user-1',
                full_name: 'Shylesh',
                email: 'mshylesh.it@gmail.com',
                phone: '9999999999',
                business_name: 'Acme',
                customer_code: 'CUS-0147E2A1',
                account_role: 'owner',
                account_status: 'active',
                must_change_password: true,
                created_at: '2024-01-01T00:00:00Z',
                last_login_at: '2024-02-02T00:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.users[0]).toMatchObject({
      id: 'user-1',
      email: 'mshylesh.it@gmail.com',
      full_name: 'Shylesh',
      phone: '9999999999',
      business_name: 'Acme',
      customer_code: 'CUS-0147E2A1',
      account_role: 'owner',
      account_status: 'active',
    });
    expect(json.users[0]).not.toHaveProperty('password');
    expect(json.users[0]).not.toHaveProperty('password_hash');
  });

  it('resets a user password without revealing the stored password', async () => {
    mocks.updateUserById.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          update: () => ({
            eq: () => ({
              eq: () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      return {
        insert: () => ({ data: null, error: null }),
      };
    });
    ctx.supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { user_id: 'user-1', account_role: 'admin' }, error: null }),
          }),
        }),
      }),
    });

    const response = await PATCH(
      new Request('http://localhost/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user-1', action: 'resetPassword' }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.temporaryPassword).toBeTypeOf('string');
    expect(json).not.toHaveProperty('password');
  });

  it('blocks deleting protected users and self without a confirmation', async () => {
    ctx.supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { user_id: 'user-1', account_role: 'owner', customer_code: 'CUS-0147E2A1' },
              error: null,
            }),
          }),
        }),
      }),
    });

    const response = await DELETE(
      new Request('http://localhost/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user-1', confirmText: 'DELETE' }),
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/protected|cannot|delete/i);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});
