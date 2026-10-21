import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { IonSpinner } from '@ionic/react';
import { deleteMonthlyBudget, loadMonthlyBudget, saveMonthlyBudget } from '../../api';
import type { FinanceState, MonthlyBudget } from '../../api';
import { getBudgetProgress } from '../analysis/selectors';
import { parseBudgetAmount } from './validation';
import { MonthNavigator } from '../ledger/MonthNavigator';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const formatMonth = (month: string) => new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));

export function BudgetPage({ data, month, onMonthChange }: { data: FinanceState; month: string; onMonthChange: (month: string) => void }) {
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setBudget(null);
    setAmount('');
    void loadMonthlyBudget(month).then((nextBudget) => {
      if (!active) return;
      setBudget(nextBudget);
      setAmount(nextBudget ? String(nextBudget.amount) : '');
    }).catch((cause: unknown) => {
      if (active) setLoadError(cause instanceof Error ? cause.message : 'No se pudo cargar el presupuesto.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, retry]);

  const spent = useMemo(() => data.movements.filter((movement) => movement.kind === 'expense' && movement.date.startsWith(`${month}-`)).reduce((sum, movement) => sum + movement.amount, 0), [data.movements, month]);
  const progress = budget ? getBudgetProgress(budget.amount, spent) : null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = parseBudgetAmount(amount);
    if (parsedAmount === null) {
      setError('Ingresa un monto mayor que cero, con hasta dos decimales.');
      setNotice('');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveMonthlyBudget(month, parsedAmount);
      setBudget(saved);
      setAmount(String(saved.amount));
      setNotice('Presupuesto guardado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el presupuesto.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!budget || !window.confirm('Se borrará el límite de este mes.')) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await deleteMonthlyBudget(month);
      setBudget(null);
      setAmount('');
      setNotice('Presupuesto eliminado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el presupuesto.');
    } finally {
      setSaving(false);
    }
  }

  return <section>
    <header className="month-heading feature-heading">
      <div><p className="eyebrow">PLANIFICACIÓN</p><h1>Presupuesto</h1><p className="heading-note">Define un límite y compáralo con tus gastos del mes.</p></div>
      <MonthNavigator month={month} onChange={(next) => { onMonthChange(next); setError(''); setNotice(''); }} />
    </header>
    {loading ? <div className="feature-state"><IonSpinner name="crescent" /><span>Cargando presupuesto…</span></div> : loadError ? <div className="connection-banner connection-error"><span>{loadError}</span><button className="text-action" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div> : <div className="budget-layout">
      <section className="budget-overview" aria-label="Resumen del presupuesto">
        <div className="budget-label-row"><span className="eyebrow">{budget ? 'LÍMITE DEL MES' : 'GASTOS DEL MES'}</span><span className="budget-month-label">{formatMonth(month)}</span></div>
        {budget ? <>
          <strong className="budget-value">{currency.format(budget.amount)}</strong>
          <div className="budget-progress" role="progressbar" aria-label="Presupuesto utilizado" aria-valuemin={0} aria-valuemax={budget.amount} aria-valuenow={Math.min(spent, budget.amount)}><span className={progress && progress.remaining < 0 ? 'over-budget' : ''} style={{ width: `${progress?.barPercent ?? 0}%` }} /></div>
          <div className="budget-metrics"><p><span>Gastado</span><strong>{currency.format(spent)}</strong></p><p><span>{progress && progress.remaining < 0 ? 'Excedido' : 'Disponible'}</span><strong className={progress && progress.remaining < 0 ? 'negative-value' : ''}>{currency.format(Math.abs(progress?.remaining ?? 0))}</strong></p></div>
          <p className="budget-hint">{progress?.percent ?? 0}% del presupuesto utilizado</p>
        </> : <><strong className="budget-value">{currency.format(spent)}</strong><p className="budget-empty-note">Aún no hay un límite para este mes. Ingresa uno para comparar tus gastos.</p></>}
      </section>
      <form className="budget-form" onSubmit={(event) => { void save(event); }}>
        <p className="eyebrow">{budget ? 'AJUSTAR PRESUPUESTO' : 'PLANEAR ESTE MES'}</p>
        <label htmlFor="budget-amount">Presupuesto total · USD</label>
        <input id="budget-amount" type="text" inputMode="decimal" placeholder="Ej. 450,00" value={amount} onChange={(event) => setAmount(event.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}
        <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Guardando…' : budget ? 'Guardar cambios' : 'Guardar presupuesto'}</button>
        {budget && <button className="danger-action" type="button" disabled={saving} onClick={() => { void remove(); }}>Eliminar presupuesto</button>}
        <p className="budget-footnote">Cada mes conserva su propio límite. Las transferencias quedan fuera del total de gastos.</p>
      </form>
    </div>}
  </section>;
}
