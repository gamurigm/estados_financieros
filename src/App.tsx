import { useEffect, useMemo, useState } from 'react';
import {
  IonApp,
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonToast,
} from '@ionic/react';
import {
  addOutline,
  arrowBackOutline,
  arrowForwardOutline,
  cashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  closeOutline,
  createOutline,
  swapHorizontalOutline,
  walletOutline,
} from 'ionicons/icons';
import { deleteMovement as deleteMovementRequest, loadFinanceState, saveCategories as saveCategoriesRequest, saveMovement as saveMovementRequest, saveOpeningBalance } from './api';
import type { AccountId, Category, FinanceState as Data } from './api';

const accounts: { id: AccountId; name: string }[] = [
  { id: 'cash', name: 'Efectivo' },
  { id: 'bank', name: 'Débito · cuenta bancaria' },
];

const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateForMonth = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`;
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
const monthLabel = (month: string) => new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
const accountName = (id?: AccountId) => accounts.find((account) => account.id === id)?.name ?? '';

type MovementDraft = { id?: string; date: string; kind: 'income' | 'expense'; amount: string; categoryId: string; account: AccountId; note: string };
type TransferDraft = { date: string; amount: string; account: AccountId; toAccount: AccountId; note: string };
type CellSelection = { date: string; category: Category };

export default function App() {
  const [data, setData] = useState<Data>({ categories: [], movements: [], opening: { cash: 0, bank: 0 } });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [month, setMonth] = useState(localDate(new Date()).slice(0, 7));
  const [filter, setFilter] = useState<'all' | AccountId>('all');
  const [draft, setDraft] = useState<MovementDraft | null>(null);
  const [transfer, setTransfer] = useState<TransferDraft | null>(null);
  const [categoryOpen, setCategoryOpen] = useState<'income' | 'expense' | null>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [openingDraft, setOpeningDraft] = useState<Record<AccountId, number>>({ cash: 0, bank: 0 });
  const [cell, setCell] = useState<CellSelection | null>(null);
  const [toast, setToast] = useState('');
  const activeCategories = data.categories.filter((category) => category.active);
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const monthMovements = useMemo(() => data.movements.filter((movement) => movement.date.startsWith(month)), [data.movements, month]);
  const visibleMovements = monthMovements.filter((movement) => filter === 'all' || movement.account === filter || (movement.kind === 'income' && movement.toAccount === filter));
  const incomeTotal = visibleMovements.filter((movement) => movement.kind === 'income').reduce((sum, movement) => sum + movement.amount, 0);
  const expenseTotal = visibleMovements.filter((movement) => movement.kind === 'expense').reduce((sum, movement) => sum + movement.amount, 0);
  const monthEnd = dateForMonth(month, days);

  const refreshData = async () => {
    const latest = await loadFinanceState();
    setData(latest);
    setApiError('');
  };

  useEffect(() => {
    let mounted = true;
    loadFinanceState().then((latest) => { if (mounted) setData(latest); }).catch((error: unknown) => {
      if (mounted) setApiError(error instanceof Error ? error.message : 'No se pudo conectar con PostgreSQL local.');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const runChange = async (change: () => Promise<unknown>, success: string) => {
    try {
      await change();
      await refreshData();
      setToast(success);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo guardar.');
    }
  };

  const balanceAt = (account: AccountId) => data.movements.reduce((balance, movement) => {
    if (movement.date > monthEnd) return balance;
    if (movement.kind === 'income' && movement.toAccount === account) return balance + movement.amount;
    if (movement.kind === 'expense' && movement.account === account) return balance - movement.amount;
    if (movement.kind === 'transfer' && movement.account === account) return balance - movement.amount;
    if (movement.kind === 'transfer' && movement.toAccount === account) return balance + movement.amount;
    return balance;
  }, data.opening[account] ?? 0);

  const totalForCell = (categoryId: string, date: string) => visibleMovements
    .filter((movement) => movement.date === date && movement.categoryId === categoryId)
    .reduce((sum, movement) => sum + movement.amount, 0);

  const makeDraft = (kind: 'income' | 'expense', date = localDate(new Date()), categoryId = ''): MovementDraft => ({
    date,
    kind,
    amount: '',
    categoryId: categoryId || activeCategories.find((category) => category.kind === kind)?.id || '',
    account: 'cash',
    note: '',
  });

  const saveMovement = async () => {
    if (!draft || !draft.amount || Number(draft.amount) <= 0 || !draft.categoryId) return;
    const movement = {
      ...(draft.id ? { id: draft.id } : {}),
      date: draft.date,
      kind: draft.kind,
      amount: Number(draft.amount),
      categoryId: draft.categoryId,
      ...(draft.kind === 'income' ? { toAccount: draft.account } : { account: draft.account }),
      note: draft.note.trim(),
    };
    await runChange(() => saveMovementRequest(movement), 'Movimiento guardado');
    setDraft(null);
    setCell(null);
  };

  const saveTransfer = async () => {
    if (!transfer || !transfer.amount || Number(transfer.amount) <= 0 || transfer.account === transfer.toAccount) return;
    const movement = { date: transfer.date, kind: 'transfer' as const, amount: Number(transfer.amount), account: transfer.account, toAccount: transfer.toAccount, note: transfer.note.trim() };
    await runChange(() => saveMovementRequest(movement), 'Transferencia guardada');
    setTransfer(null);
  };

  const removeMovement = (id: string) => {
    void runChange(() => deleteMovementRequest(id), 'Movimiento eliminado');
  };

  const saveCategories = (categories: Category[]) => {
    void runChange(() => saveCategoriesRequest(categories), 'Rubros guardados');
  };

  const saveBalances = async () => {
    await runChange(() => Promise.all(accounts.map((account) => saveOpeningBalance(account.id, openingDraft[account.id]))), 'Saldos iniciales guardados');
    setBalanceOpen(false);
  };

  const moveMonth = (offset: number) => {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    setMonth(localDate(date).slice(0, 7));
  };

  const categoryMovements = cell ? visibleMovements.filter((movement) => movement.date === cell.date && movement.categoryId === cell.category.id) : [];

  return (
    <IonApp>
      <IonContent fullscreen>
        <main className="workspace">
          <header className="topbar">
            <a className="brand-mark" href="#inicio" aria-label="Estados financieros"><span>ef</span></a>
            <div className="brand-copy"><strong>Estados financieros</strong><span>Tu mes, claro y en orden</span></div>
            <div className="top-actions">
              <IonButton fill="outline" className="quiet-button" onClick={() => { setOpeningDraft(data.opening); setBalanceOpen(true); }}><IonIcon slot="start" icon={walletOutline} /><span className="action-label">Saldos iniciales</span></IonButton>
              <IonButton fill="outline" className="quiet-button" onClick={() => setCategoryOpen('expense')}><IonIcon slot="start" icon={createOutline} /><span className="action-label">Rubros</span></IonButton>
              <IonButton fill="outline" className="quiet-button" onClick={() => setTransfer({ date: localDate(new Date()), amount: '', account: 'bank', toAccount: 'cash', note: '' })}><IonIcon slot="start" icon={swapHorizontalOutline} /><span className="action-label">Transferir</span></IonButton>
              <IonButton className="add-button" onClick={() => setDraft(makeDraft('expense'))}><IonIcon slot="start" icon={addOutline} /><span className="action-label">Registrar</span></IonButton>
            </div>
          </header>

          {loading && <div className="connection-banner"><IonSpinner name="crescent" /> Conectando con PostgreSQL local…</div>}
          {apiError && <div className="connection-banner connection-error"><span>{apiError} Inicia la base y la API con <code>npm run local</code>.</span><IonButton size="small" fill="outline" onClick={() => { setLoading(true); void refreshData().catch((error: unknown) => setApiError(error instanceof Error ? error.message : 'Error de conexión.')).finally(() => setLoading(false)); }}>Reintentar</IonButton></div>}

          <section className="month-heading" id="inicio">
            <div>
              <p className="eyebrow">CONTROL PERSONAL</p>
              <h1>Ingresos y gastos</h1>
              <p className="heading-note">Un solo rubro. Cada pago queda en su cuenta.</p>
            </div>
            <div className="month-controls">
              <div className="month-picker">
                <button aria-label="Mes anterior" onClick={() => moveMonth(-1)}><IonIcon icon={chevronBackOutline} /></button>
                <label htmlFor="month-input">{monthLabel(month)}</label>
                <input id="month-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Elegir mes" />
                <button aria-label="Mes siguiente" onClick={() => moveMonth(1)}><IonIcon icon={chevronForwardOutline} /></button>
              </div>
              <div className="account-filter" role="group" aria-label="Filtrar por cuenta">
                {([['all', 'Todo'], ['cash', 'Efectivo'], ['bank', 'Débito']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}
              </div>
            </div>
          </section>

          <section className="summary-strip" aria-label="Resumen del mes">
            <article className="summary-item income-summary"><span>Ingresos del mes</span><strong>{money.format(incomeTotal)}</strong><small><IonIcon icon={arrowBackOutline} /> Entradas registradas</small></article>
            <article className="summary-item expense-summary"><span>Gastos del mes</span><strong>{money.format(expenseTotal)}</strong><small><IonIcon icon={arrowForwardOutline} /> Salidas registradas</small></article>
            <article className="summary-item net-summary"><span>Balance del mes</span><strong>{money.format(incomeTotal - expenseTotal)}</strong><small>Ingresos menos gastos</small></article>
            <article className="accounts-summary"><span>Disponible al cierre</span><div>{accounts.map((account) => <p key={account.id}><span><i className={`account-dot ${account.id}`} />{account.id === 'bank' ? 'Banco / débito' : account.name}</span><strong>{money.format(balanceAt(account.id))}</strong></p>)}</div></article>
          </section>

          <section className="sheet-section">
            <div className="sheet-heading">
              <div><h2>{monthLabel(month)}</h2><p>Selecciona una celda para ver o agregar movimientos.</p></div>
              <span className="sheet-hint"><IonIcon icon={cashOutline} /> Valores en USD</span>
            </div>
            <div className="sheet-scroll" role="region" aria-label="Tabla mensual de ingresos y gastos" tabIndex={0}>
              <table className="ledger">
                <thead>
                  <tr><th className="category-column">Rubro</th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); return <th key={date} className={`day-heading ${isWeekend(date) ? 'weekend-heading' : ''}`}><span>{new Intl.DateTimeFormat('es-EC', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '')}</span><strong>{index + 1}</strong></th>; })}<th className="total-heading">Total</th></tr>
                </thead>
                <tbody>
                  <tr className="section-row income-section"><th colSpan={days + 2}>Ingresos <span>· {money.format(incomeTotal)}</span><button onClick={() => setCategoryOpen('income')} aria-label="Agregar rubro de ingreso"><IonIcon icon={addOutline} /></button></th></tr>
                  {activeCategories.filter((category) => category.kind === 'income').map((category) => <tr className="category-row income-row" key={category.id}><th className="category-column"><span>{category.name}</span><small>Ingreso</small></th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); const amount = totalForCell(category.id, date); return <td key={date} className={isWeekend(date) ? 'weekend-cell' : undefined}><button className={`cell-value ${amount ? 'has-value' : ''}`} onClick={() => setCell({ date, category })} aria-label={`${category.name}, día ${index + 1}, ${money.format(amount)}`}>{amount ? money.format(amount) : <span className="empty-cell">·</span>}</button></td>; })}<td className="row-total">{money.format(Array.from({ length: days }, (_, index) => totalForCell(category.id, dateForMonth(month, index + 1))).reduce((sum, amount) => sum + amount, 0))}</td></tr>)}
                  <tr className="daily-total income-daily"><th className="category-column">Total ingresos</th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); return <td key={date} className={isWeekend(date) ? 'weekend-cell' : undefined}>{money.format(visibleMovements.filter((movement) => movement.kind === 'income' && movement.date === date).reduce((sum, movement) => sum + movement.amount, 0))}</td>; })}<td className="row-total">{money.format(incomeTotal)}</td></tr>
                  <tr className="section-row expense-section"><th colSpan={days + 2}>Gastos <span>· {money.format(expenseTotal)}</span><button onClick={() => setCategoryOpen('expense')} aria-label="Agregar rubro de gasto"><IonIcon icon={addOutline} /></button></th></tr>
                  {activeCategories.filter((category) => category.kind === 'expense').map((category) => <tr className="category-row expense-row" key={category.id}><th className="category-column"><span>{category.name}</span><small>Gasto</small></th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); const amount = totalForCell(category.id, date); return <td key={date} className={isWeekend(date) ? 'weekend-cell' : undefined}><button className={`cell-value ${amount ? 'has-value' : ''}`} onClick={() => setCell({ date, category })} aria-label={`${category.name}, día ${index + 1}, ${money.format(amount)}`}>{amount ? money.format(amount) : <span className="empty-cell">·</span>}</button></td>; })}<td className="row-total">{money.format(Array.from({ length: days }, (_, index) => totalForCell(category.id, dateForMonth(month, index + 1))).reduce((sum, amount) => sum + amount, 0))}</td></tr>)}
                  <tr className="daily-total expense-daily"><th className="category-column">Total gastos</th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); return <td key={date} className={isWeekend(date) ? 'weekend-cell' : undefined}>{money.format(visibleMovements.filter((movement) => movement.kind === 'expense' && movement.date === date).reduce((sum, movement) => sum + movement.amount, 0))}</td>; })}<td className="row-total">{money.format(expenseTotal)}</td></tr>
                  <tr className="net-daily"><th className="category-column">Balance diario</th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); const total = visibleMovements.filter((movement) => movement.date === date); return <td key={date} className={isWeekend(date) ? 'weekend-cell' : undefined}>{money.format(total.filter((movement) => movement.kind === 'income').reduce((sum, movement) => sum + movement.amount, 0) - total.filter((movement) => movement.kind === 'expense').reduce((sum, movement) => sum + movement.amount, 0))}</td>; })}<td className="row-total">{money.format(incomeTotal - expenseTotal)}</td></tr>
                </tbody>
              </table>
            </div>
            <footer className="sheet-footer"><span>Guardado en PostgreSQL local.</span><span><i className="account-dot cash" /> Efectivo <i className="account-dot bank" /> Débito</span></footer>
          </section>
        </main>
      </IonContent>

      <IonModal isOpen={!!draft} onDidDismiss={() => setDraft(null)} className="form-modal">
        <div className="modal-shell">
          <div className="modal-heading"><div><span className="modal-kicker">MOVIMIENTO</span><h2>{draft?.id ? 'Editar movimiento' : draft?.kind === 'income' ? 'Registrar ingreso' : 'Registrar gasto'}</h2></div><button className="icon-close" onClick={() => setDraft(null)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></div>
          {draft && <div className="form-fields">
            <div className="kind-switch"><button className={draft.kind === 'income' ? 'active income-active' : ''} onClick={() => setDraft({ ...draft, kind: 'income', categoryId: activeCategories.find((category) => category.kind === 'income')?.id ?? '' })}>Ingreso</button><button className={draft.kind === 'expense' ? 'active expense-active' : ''} onClick={() => setDraft({ ...draft, kind: 'expense', categoryId: activeCategories.find((category) => category.kind === 'expense')?.id ?? '' })}>Gasto</button></div>
            <IonItem className="form-item"><IonInput label="Monto" labelPlacement="stacked" type="number" min="0.01" step="0.01" placeholder="0,00" value={draft.amount} onIonInput={(event) => setDraft({ ...draft, amount: String(event.detail.value ?? '') })} /></IonItem>
            <IonItem className="form-item"><IonSelect label="Rubro" labelPlacement="stacked" interface="popover" value={draft.categoryId} onIonChange={(event) => setDraft({ ...draft, categoryId: event.detail.value })}>{activeCategories.filter((category) => category.kind === draft.kind).map((category) => <IonSelectOption key={category.id} value={category.id}>{category.name}</IonSelectOption>)}</IonSelect></IonItem>
            <IonItem className="form-item"><IonSelect label={draft.kind === 'income' ? 'Recibir en' : 'Pagar con'} labelPlacement="stacked" interface="popover" value={draft.account} onIonChange={(event) => setDraft({ ...draft, account: event.detail.value })}>{accounts.map((account) => <IonSelectOption key={account.id} value={account.id}>{account.id === 'bank' ? 'Débito · cuenta bancaria' : account.name}</IonSelectOption>)}</IonSelect></IonItem>
            <IonItem className="form-item"><IonInput label="Fecha" labelPlacement="stacked" type="date" value={draft.date} onIonInput={(event) => setDraft({ ...draft, date: String(event.detail.value ?? '') })} /></IonItem>
            <IonItem className="form-item note-item"><IonTextarea label="Descripción (opcional)" labelPlacement="stacked" autoGrow rows={2} value={draft.note} onIonInput={(event) => setDraft({ ...draft, note: String(event.detail.value ?? '') })} /></IonItem>
            <div className="modal-actions">{draft.id && <IonButton fill="clear" color="danger" onClick={() => { removeMovement(draft.id!); setDraft(null); }}>Eliminar</IonButton>}<IonButton fill="outline" onClick={() => setDraft(null)}>Cancelar</IonButton><IonButton onClick={saveMovement}>Guardar</IonButton></div>
          </div>}
        </div>
      </IonModal>

      <IonModal isOpen={!!cell} onDidDismiss={() => setCell(null)} className="form-modal">
        <div className="modal-shell cell-modal">
          <div className="modal-heading"><div><span className="modal-kicker">{cell?.category.kind === 'income' ? 'INGRESOS' : 'GASTOS'} · {cell?.date}</span><h2>{cell?.category.name}</h2></div><button className="icon-close" onClick={() => setCell(null)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></div>
          {cell && <>
            <div className="cell-movements">{categoryMovements.length ? categoryMovements.map((movement) => <article className="movement-line" key={movement.id}><div><strong>{money.format(movement.amount)}</strong><span>{accountName(movement.kind === 'income' ? movement.toAccount : movement.account)}{movement.note ? ` · ${movement.note}` : ''}</span></div><button aria-label="Editar movimiento" onClick={() => { setCell(null); setDraft({ id: movement.id, date: movement.date, kind: movement.kind as 'income' | 'expense', amount: String(movement.amount), categoryId: movement.categoryId ?? '', account: (movement.kind === 'income' ? movement.toAccount : movement.account) ?? 'cash', note: movement.note }); }}><IonIcon icon={createOutline} /></button><button aria-label="Eliminar movimiento" onClick={() => removeMovement(movement.id)}><IonIcon icon={closeOutline} /></button></article>) : <p className="empty-state">No hay movimientos para este rubro y día.</p>}</div>
            <IonButton expand="block" onClick={() => { const next = makeDraft(cell.category.kind, cell.date, cell.category.id); setCell(null); setDraft(next); }}><IonIcon slot="start" icon={addOutline} /> Agregar movimiento</IonButton>
          </>}
        </div>
      </IonModal>

      <CategoryManager open={categoryOpen !== null} initialKind={categoryOpen ?? 'expense'} categories={data.categories} onClose={() => setCategoryOpen(null)} onSave={saveCategories} />

      <IonModal isOpen={!!transfer} onDidDismiss={() => setTransfer(null)} className="form-modal">
        <div className="modal-shell"><div className="modal-heading"><div><span className="modal-kicker">ENTRE TUS CUENTAS</span><h2>Transferir dinero</h2></div><button className="icon-close" onClick={() => setTransfer(null)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></div>
          {transfer && <div className="form-fields"><p className="helper-copy">El traslado cambia los saldos, pero no cuenta como ingreso ni gasto.</p>
            <IonItem className="form-item"><IonInput label="Monto" labelPlacement="stacked" type="number" min="0.01" step="0.01" placeholder="0,00" value={transfer.amount} onIonInput={(event) => setTransfer({ ...transfer, amount: String(event.detail.value ?? '') })} /></IonItem>
            <IonItem className="form-item"><IonSelect label="Desde" labelPlacement="stacked" value={transfer.account} onIonChange={(event) => setTransfer({ ...transfer, account: event.detail.value })}>{accounts.map((account) => <IonSelectOption key={account.id} value={account.id}>{account.name}</IonSelectOption>)}</IonSelect></IonItem>
            <IonItem className="form-item"><IonSelect label="Hacia" labelPlacement="stacked" value={transfer.toAccount} onIonChange={(event) => setTransfer({ ...transfer, toAccount: event.detail.value })}>{accounts.map((account) => <IonSelectOption key={account.id} value={account.id}>{account.name}</IonSelectOption>)}</IonSelect></IonItem>
            <IonItem className="form-item"><IonInput label="Fecha" labelPlacement="stacked" type="date" value={transfer.date} onIonInput={(event) => setTransfer({ ...transfer, date: String(event.detail.value ?? '') })} /></IonItem>
            <IonItem className="form-item"><IonInput label="Descripción (opcional)" labelPlacement="stacked" value={transfer.note} onIonInput={(event) => setTransfer({ ...transfer, note: String(event.detail.value ?? '') })} /></IonItem>
            <div className="modal-actions"><IonButton fill="outline" onClick={() => setTransfer(null)}>Cancelar</IonButton><IonButton onClick={saveTransfer} disabled={transfer.account === transfer.toAccount}>Guardar transferencia</IonButton></div>
          </div>}
        </div>
      </IonModal>

      <IonModal isOpen={balanceOpen} onDidDismiss={() => setBalanceOpen(false)} className="form-modal">
        <div className="modal-shell"><div className="modal-heading"><div><span className="modal-kicker">PUNTO DE PARTIDA</span><h2>Saldos iniciales</h2></div><button className="icon-close" onClick={() => setBalanceOpen(false)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></div>
          <p className="helper-copy balance-copy">Registra cuánto tenías al comenzar a usar la app. Los movimientos actualizarán estos saldos.</p>
          <div className="form-fields">{accounts.map((account) => <IonItem className="form-item" key={account.id}><IonInput label={account.id === 'bank' ? 'Banco / débito' : 'Efectivo'} labelPlacement="stacked" type="number" step="0.01" value={String(openingDraft[account.id] ?? 0)} onIonInput={(event) => setOpeningDraft((current) => ({ ...current, [account.id]: Number(event.detail.value ?? 0) }))} /></IonItem>)}<div className="modal-actions"><IonButton fill="outline" onClick={() => setBalanceOpen(false)}>Cancelar</IonButton><IonButton onClick={saveBalances}>Guardar saldos</IonButton></div></div>
        </div>
      </IonModal>
      <IonToast isOpen={!!toast} message={toast} duration={2200} onDidDismiss={() => setToast('')} position="bottom" />
    </IonApp>
  );
}

function CategoryManager({ open, initialKind, categories, onClose, onSave }: { open: boolean; initialKind: 'income' | 'expense'; categories: Category[]; onClose: () => void; onSave: (categories: Category[]) => void }) {
  const [kind, setKind] = useState<'income' | 'expense'>(initialKind);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const list = categories.filter((category) => category.kind === kind);

  useEffect(() => {
    if (open) { setKind(initialKind); setName(''); setEditingId(null); }
  }, [open, initialKind]);

  const save = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (editingId) onSave(categories.map((category) => category.id === editingId ? { ...category, name: cleanName } : category));
    else onSave([...categories, { id: crypto.randomUUID(), name: cleanName, kind, active: true }]);
    setName('');
    setEditingId(null);
  };

  return <IonModal isOpen={open} onDidDismiss={onClose} className="form-modal">
    <div className="modal-shell category-modal"><div className="modal-heading"><div><span className="modal-kicker">PERSONALIZA TU HOJA</span><h2>Rubros</h2></div><button className="icon-close" onClick={onClose} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></div>
      <div className="kind-switch"><button className={kind === 'income' ? 'active income-active' : ''} onClick={() => { setKind('income'); setName(''); setEditingId(null); }}>Ingresos</button><button className={kind === 'expense' ? 'active expense-active' : ''} onClick={() => { setKind('expense'); setName(''); setEditingId(null); }}>Gastos</button></div>
      <div className="category-add"><IonInput label={editingId ? 'Cambiar nombre' : 'Nuevo rubro'} labelPlacement="stacked" placeholder="Ej. Mascotas" value={name} onIonInput={(event) => setName(String(event.detail.value ?? ''))} /><IonButton onClick={save} disabled={!name.trim()}>{editingId ? 'Guardar' : 'Agregar'}</IonButton></div>
      <div className="category-list">{list.map((category) => <div className={`category-manage-row ${category.active ? '' : 'inactive'}`} key={category.id}><span>{category.name}{!category.active && <small>Desactivado</small>}</span><div><button aria-label={`Editar ${category.name}`} onClick={() => { setEditingId(category.id); setName(category.name); }}><IonIcon icon={createOutline} /></button><button aria-label={category.active ? `Desactivar ${category.name}` : `Activar ${category.name}`} onClick={() => onSave(categories.map((item) => item.id === category.id ? { ...item, active: !item.active } : item))}>{category.active ? 'Desactivar' : 'Activar'}</button></div></div>)}</div>
      <div className="modal-actions"><IonButton fill="outline" onClick={onClose}>Cerrar</IonButton></div>
    </div>
  </IonModal>;
}
