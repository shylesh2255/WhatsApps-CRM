import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { hasMinRole } from '@/lib/auth/roles'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  loadStepsTree,
  replaceSteps,
  type BuilderStepInput,
} from '@/lib/automations/steps-tree'
import {
  validateStepsForActivation,
  validateTriggerForActivation,
} from '@/lib/automations/validate'

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = supabaseAdmin()
  const { data: automation, error } = await admin
    .from('automations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const steps = await loadStepsTree(id)
  return NextResponse.json({ automation, steps })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Editing an automation definition is allowed at any role — see the
  // POST handler in ../route.ts for why viewer is intentional here.
  let callerRole: import('@/lib/auth/roles').AccountRole
  let callerAccountId: string
  try {
    const ctx = await requireRole('viewer')
    callerRole = ctx.role
    callerAccountId = ctx.accountId
  } catch (err) {
    return toErrorResponse(err)
  }

  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const admin = supabaseAdmin()

  // Ownership check before we touch anything. Load the fields we need
  // to compute the post-patch "effective" state for validation.
  const { data: existing } = await admin
    .from('automations')
    .select('id, user_id, account_id, is_active, trigger_type, trigger_config')
    .eq('id', id)
    .maybeSingle()

  const isAuthor = !!existing && existing.user_id === user.id
  // agent+ may review (approve/reject) any automation in their own
  // account — this is the only way a viewer's submission ever gets
  // approved, since the viewer who authored it can't self-approve.
  const isReviewer =
    !!existing && existing.account_id === callerAccountId && hasMinRole(callerRole, 'agent')
  if (!existing || (!isAuthor && !isReviewer)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}

  if (isAuthor) {
    for (const k of [
      'name',
      'description',
      'trigger_type',
      'trigger_config',
      'is_active',
    ] as const) {
      if (k in body) update[k] = body[k]
    }
    // A viewer editing their own automation always sends it back for
    // re-review, no matter what changed — see 075_automation_approval.sql.
    if (!hasMinRole(callerRole, 'agent') && Object.keys(update).length > 0) {
      update.approval_status = 'pending'
      update.is_active = false
    }
  }

  if (isReviewer && 'approval_status' in body) {
    const next = body.approval_status
    if (next === 'approved' || next === 'rejected') {
      update.approval_status = next
      update.reviewed_by = user.id
      update.reviewed_at = new Date().toISOString()
      if (next === 'rejected') {
        update.rejection_reason =
          typeof body.rejection_reason === 'string' ? body.rejection_reason : null
        update.is_active = false
      }
    }
  }

  if (Object.keys(update).length === 0 && !(isAuthor && Array.isArray(body.steps))) {
    return NextResponse.json({ error: 'No recognized fields to update' }, { status: 400 })
  }

  // If this PATCH leaves the automation active (either explicitly
  // activating it OR editing an already-active one), validate the
  // merged configuration first. Activation is the natural gate — drafts
  // are still allowed to be incomplete.
  const willBeActive =
    typeof update.is_active === 'boolean' ? update.is_active : existing.is_active
  if (willBeActive) {
    const mergedTriggerType = (update.trigger_type ?? existing.trigger_type) as string
    const mergedTriggerConfig = update.trigger_config ?? existing.trigger_config
    const mergedSteps = Array.isArray(body.steps)
      ? (body.steps as { step_type: string; step_config: Record<string, unknown> }[])
      : await loadStepsTree(id)
    const issues = [
      ...validateTriggerForActivation(mergedTriggerType, mergedTriggerConfig),
      ...validateStepsForActivation(mergedSteps),
    ]
    if (issues.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot keep automation active with invalid configuration',
          issues,
        },
        { status: 400 },
      )
    }
  }

  if (Object.keys(update).length > 0) {
    const { error: updErr } = await admin
      .from('automations')
      .update(update)
      .eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  if (isAuthor && Array.isArray(body.steps)) {
    const err = await replaceSteps(id, body.steps as BuilderStepInput[])
    if (err) return NextResponse.json({ error: err }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Deleting an automation definition is allowed at any role — see the
  // POST handler in ../route.ts for why viewer is intentional here.
  try {
    await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }

  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin()
    .from('automations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
