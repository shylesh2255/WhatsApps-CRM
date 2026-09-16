'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Task = { id: string; task_number: number; title: string; client_name: string; phone_number: string; description: string; priority: string; due_date: string | null; notes: string | null; status: string; branch_id: string; company_name: string; created_by_name: string; created_at: string; branches?: { name?: string } | null; task_feedback?: { rating: number; comment: string | null }[] };
type Branch = { id: string; name: string; code: string; active: boolean };
const initialForm = { title: '', clientName: '', phoneNumber: '', description: '', branchId: '', assignedTo: '', priority: 'NORMAL', dueDate: '', notes: '' };
const statusLabels = { PENDING: 'Pending', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState<Record<string, { rating: string; comment: string }>>({});
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/admin/tasks', { cache: 'no-store' });
    const result = await response.json();
    if (response.ok) {
      setTasks(result.tasks ?? []);
      setCompanyName(result.company_name ?? '');
    }
    else setError(result.error ?? 'Unable to load tasks');
  }
  async function loadBranches() {
    const response = await fetch('/api/admin/branches');
    const result = await response.json();
    if (response.ok) {
      const activeBranches = (result.branches ?? []).filter((branch: Branch) => branch.active);
      setBranches(activeBranches);
      setForm((current) => ({ ...current, branchId: current.branchId || activeBranches[0]?.id || '' }));
    } else setError(result.error ?? 'Unable to load company branches');
  }
  useEffect(() => {
    // These fetches update local state when the external requests complete.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void loadBranches();
  }, []);

  async function createTask(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const response = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) return setError(result.error ?? 'Unable to create task');
    setForm(initialForm); setShowForm(false); setMessage(`Task #${result.task.task_number} created. WhatsApp notification attempted.`); void load();
  }

  async function updateStatus(task: Task, status: string) {
    const response = await fetch('/api/admin/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, status }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? 'Unable to update task');
    else { setMessage(`Task #${task.task_number} updated. Client notification attempted.`); void load(); }
  }

  async function saveFeedback(task: Task) {
    const value = feedback[task.id];
    const response = await fetch('/api/admin/tasks/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.id, rating: Number(value?.rating), comment: value?.comment }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? 'Unable to save feedback');
    else setMessage(`Feedback saved for task #${task.task_number}.`);
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-foreground text-2xl font-bold">Task management</h1><p className="text-muted-foreground mt-1 text-sm">Create tasks, track progress, notify clients, and capture completion feedback.</p></div><Button type="button" onClick={() => setShowForm((open) => !open)}>{showForm ? 'Close form' : 'Create task'}</Button></div>
    {error && <p className="text-sm text-red-500">{error}</p>}{message && <p className="text-sm text-emerald-600">{message}</p>}
    {showForm && <form onSubmit={createTask} className="border-border bg-card grid gap-3 rounded-xl border p-5 md:grid-cols-2">
      <div className="border-border bg-muted/30 text-foreground rounded-md border px-3 py-2 text-sm md:col-span-2">Company: <strong>{companyName || 'Current company'}</strong> (assigned automatically)</div>
      <Input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Input required placeholder="Client name" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
      <Input required placeholder="Phone number with country code" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
      <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
      <select required className="border-input bg-background text-foreground h-10 rounded-md border px-3 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="LOW">Low priority</option><option value="NORMAL">Normal priority</option><option value="HIGH">High priority</option><option value="URGENT">Urgent priority</option></select>
      <select required disabled={!branches.length} className="border-input bg-background text-foreground h-10 rounded-md border px-3 text-sm disabled:opacity-60" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">{branches.length ? 'Select company branch' : 'No branch configured'}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}</select>
      <textarea required rows={3} placeholder="Description" className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm md:col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <textarea rows={2} placeholder="Notes" className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm md:col-span-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <Button type="submit">Create task and notify client</Button>
    </form>}
    <div className="grid gap-4 xl:grid-cols-3">{(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((status) => <section key={status} className="space-y-3"><h2 className="text-foreground font-semibold">{statusLabels[status]} <span className="text-muted-foreground text-sm">({tasks.filter((task) => task.status === status).length})</span></h2>{tasks.filter((task) => task.status === status).map((task) => <article key={task.id} className="border-border bg-card rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-primary text-xs font-semibold">TASK-{String(task.task_number).padStart(5, '0')}</p><h3 className="text-foreground mt-1 font-semibold">{task.title}</h3></div><span className="text-muted-foreground text-xs">{task.priority}</span></div><div className="text-muted-foreground mt-3 grid gap-1 text-xs sm:grid-cols-2"><span>Created: {new Date(task.created_at).toLocaleDateString()}</span><span>Company: {task.company_name}</span><span>Branch ID: {task.branch_id}</span><span>Created by: {task.created_by_name}</span></div><p className="text-foreground mt-3 text-sm">{task.client_name} · {task.phone_number}</p><p className="text-muted-foreground mt-2 text-sm">{task.description}</p><p className="text-muted-foreground mt-3 text-xs">Due: {task.due_date ?? 'No due date'}{task.branches?.name ? ` · ${task.branches.name}` : ''}</p>{status !== 'COMPLETED' && <select className="border-input bg-background text-foreground mt-4 h-9 w-full rounded-md border px-2 text-sm" value={task.status} onChange={(e) => void updateStatus(task, e.target.value)}><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select>}{status === 'COMPLETED' && <div className="border-border mt-4 border-t pt-4"><p className="text-foreground text-sm font-medium">Completion feedback</p><div className="mt-2 flex gap-2"><select className="border-input bg-background text-foreground h-9 rounded-md border px-2 text-sm" value={feedback[task.id]?.rating ?? ''} onChange={(e) => setFeedback({ ...feedback, [task.id]: { rating: e.target.value, comment: feedback[task.id]?.comment ?? '' } })}><option value="">Rating</option><option value="5">5 / 5</option><option value="4">4 / 5</option><option value="3">3 / 5</option><option value="2">2 / 5</option><option value="1">1 / 5</option></select><Button type="button" size="sm" onClick={() => void saveFeedback(task)}>Save</Button></div><Input className="mt-2" placeholder="Feedback notes" value={feedback[task.id]?.comment ?? ''} onChange={(e) => setFeedback({ ...feedback, [task.id]: { rating: feedback[task.id]?.rating ?? '', comment: e.target.value } })} />{process.env.NEXT_PUBLIC_GOOGLE_FEEDBACK_FORM_URL && <a className="text-primary mt-3 block text-xs hover:underline" href={`${process.env.NEXT_PUBLIC_GOOGLE_FEEDBACK_FORM_URL}?task=${task.task_number}`} target="_blank" rel="noreferrer">Open Google feedback form</a>}</div>}</article>)}</section>)}</div>
    {!tasks.length && <div className="border-border bg-card text-muted-foreground rounded-xl border p-8 text-center text-sm">No tasks yet. Create the first task to begin tracking work.</div>}
  </div>;
}