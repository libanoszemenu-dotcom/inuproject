import { useState } from 'react';
import api, { errorMessage } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Card, ConfirmDialog, EmptyState, ErrorState, PageHeader, PageLoader, Spinner, Table, TextField } from '../../components/ui';

export default function Departments() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/departments');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/departments', { name });
      toast.success('Department added');
      setName('');
      reload();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  }
  async function saveEdit() {
    setBusy(true);
    try {
      await api.put(`/departments/${editing.id}`, { name: editing.name });
      toast.success('Department renamed');
      setEditing(null);
      reload();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/departments/${removing.id}`);
      toast.success('Department deleted');
      setRemoving(null);
      reload();
    } catch (err) { toast.error(errorMessage(err)); setRemoving(null); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Departments and units" subtitle="Vacancies belong to a department. A Department Head sees the applicants of their own department." />
      <Card className="mb-6 p-5">
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <TextField className="min-w-64 flex-1" label="New department or unit name" value={name} onChange={(e) => setName(e.target.value)} required />
          <button type="submit" className="btn btn-primary" disabled={busy || name.trim().length < 3}>{busy && <Spinner className="h-4 w-4" />} Add</button>
        </form>
      </Card>
      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState title="No departments yet" message="Add the university's departments and units above." />
      ) : (
        <Card>
          <Table headers={['Name', 'Staff', 'Vacancies', '']} caption="Departments">
            {data.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium">
                  {editing?.id === d.id
                    ? <input className="input py-1" aria-label="Department name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    : d.name}
                </td>
                <td className="px-4 py-3">{d.staff_count}</td>
                <td className="px-4 py-3">{d.vacancy_count}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {editing?.id === d.id ? (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit} disabled={busy || editing.name.trim().length < 3}>Save</button>
                      <button type="button" className="btn btn-ghost btn-sm ml-1" onClick={() => setEditing(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ id: d.id, name: d.name })}>Rename</button>
                      <button type="button" className="btn btn-ghost btn-sm ml-1" onClick={() => setRemoving(d)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      <ConfirmDialog open={Boolean(removing)} title="Delete this department?" message={`"${removing?.name}" will be removed. Departments with vacancies cannot be deleted.`}
        confirmLabel="Delete" danger busy={busy} onConfirm={remove} onCancel={() => setRemoving(null)} />
    </>
  );
}
