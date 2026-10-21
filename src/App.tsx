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
  logOutOutline,
  lockClosedOutline,
  swapHorizontalOutline,
  walletOutline,
} from 'ionicons/icons';
import { changeWebPassword } from './auth';
import { createBankAccount, deleteMovement as deleteMovementRequest, loadFinanceState, saveAccount, saveCategories as saveCategoriesRequest, saveMovement as saveMovementRequest, saveOpeningBalance } from './api';
import type { Account, AccountId, Category, FinanceState as Data } from './api';
import { AnalysisPage } from './features/analysis/AnalysisPage';
import { BalanceSheetPage } from './features/analysis/BalanceSheetPage';
import { BudgetPage } from './features/budget/BudgetPage';
import { parseBudgetAmount } from './features/budget/validation';
import { CashFlowPage } from './features/analysis/CashFlowPage';
import { FinanceSidebar, type FinanceSection } from './features/navigation/FinanceSidebar';
import { ThemeToggle } from './ThemeToggle';
import type { WebThemeMode } from './theme/web-theme';

const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateForMonth = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`;
const isValidMovementDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
const monthLabel = (month: string) => new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
const accountName = (id: AccountId | undefined, accounts: Account[]) => accounts.find((account) => account.id === id)?.name ?? '';

type MovementDraft = { id?: string; date: string; kind: 'income' | 'expense'; amount: string; categoryId: string; account: AccountId; note: string };
type TransferDraft = { date: string; amount: string; account: AccountId; toAccount: AccountId; note: string };
type CellSelection = { date: string; category: Category };

export default function App({ themeMode, onThemeToggle, onLogout, onPasswordChanged }: { themeMode: WebThemeMode; onThemeToggle: () => void; onLogout: () => void; onPasswordChanged: () => void }) {
  const [data, setData] = useState<Data>({ categories: [], movements: [], accounts: [], opening: { cash: 0, bank: 0 } });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [month, setMonth] = useState(localDate(new Date()).slice(0, 7));
  const [balanceAsOfDate, setBalanceAsOfDate] = useState(() => localDate(new Date()));
  const [cashFlowEndDate, setCashFlowEndDate] = useState(() => localDate(new Date()));
  const [cashFlowStartDate, setCashFlowStartDate] = useState(() => `${localDate(new Date()).slice(0, 7)}-01`);
  const [section, setSection] = useState<FinanceSection>('ledger');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | AccountId>('all');
  const [draft, setDraft] = useState<MovementDraft | null>(null);
  const [movementError, setMovementError] = useState('');
  const [transfer, setTransfer] = useState<TransferDraft | null>(null);
  const [transferMode, setTransferMode] = useState<'transfer' | 'withdrawal'>('transfer');
  const [categoryOpen, setCategoryOpen] = useState<'income' | 'expense' | null>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [accountDrafts, setAccountDrafts] = useState<Record<AccountId, { name: string; balance: string }>>({});
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('0');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [cell, setCell] = useState<CellSelection | null>(null);
  const [toast, setToast] = useState('');

  const updateDraft = (next: MovementDraft | null) => {
    setDraft(next);
    setMovementError('');
  };
  const activeCategories = data.categories.filter((category) => category.active);
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const monthMovements = useMemo(() => data.movements.filter((movement) => movement.date.startsWith(month)), [data.movements, month]);
  const visibleMovements = monthMovements.filter((movement) => filter === 'all' || movement.account === filter || (movement.kind === 'income' && movement.toAccount === filter));
  const incomeTotal = visibleMovements.filter((movement) => movement.kind === 'income').reduce((sum, movement) => sum + movement.amount, 0);
  const expenseTotal = visibleMovements.filter((movement) => movement.kind === 'expense').reduce((sum, movement) => sum + movement.amount, 0);
  const monthEnd = dateForMonth(month, days);
  const bankAccounts = data.accounts.filter((account) => account.kind === 'bank');

  const refreshData = async () => {
    const latest = await loadFinanceState();
    setData(latest);
    setApiError('');
  };

  useEffect(() => {
    let mounted = true;
    loadFinanceState().then((latest) => { if (mounted) setData(latest); }).catch((error: unknown) => {
      if (mounted) setApiError(error instanceof Error ? error.message : 'No se pudo conectar al servidor.');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const runChange = async (change: () => Promise<unknown>, success: string) => {
    try {
      await change();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo guardar.');
      return false;
    }
    try {
      await refreshData();
      setToast(success);
    } catch {
      setToast('Cambio guardado, pero no se pudo actualizar la vista.');
    }
    return true;
  };

  const balanceAt = (accountId: AccountId) => {
    const account = data.accounts.find((item) => item.id === accountId);
    if (!account || account.startDate > monthEnd) return 0;
    return data.movements.reduce((balance, movement) => {
    if (movement.date < account.startDate || movement.date > monthEnd) return balance;
    if (movement.kind === 'income' && movement.toAccount === accountId) return balance + movement.amount;
    if (movement.kind === 'expense' && movement.account === accountId) return balance - movement.amount;
    if (movement.kind === 'transfer' && movement.account === accountId) return balance - movement.amount;
    if (movement.kind === 'transfer' && movement.toAccount === accountId) return balance + movement.amount;
    return balance;
    }, account.openingBalance);
  };

  const movementsForCell = (categoryId: string, date: string) => visibleMovements
    .filter((movement) => movement.date === date && movement.categoryId === categoryId);

  const totalForCell = (categoryId: string, date: string) => movementsForCell(categoryId, date)
    .reduce((sum, movement) => sum + movement.amount, 0);

  const makeDraft = (kind: 'income' | 'expense', date = localDate(new Date()), categoryId = ''): MovementDraft => ({
    date,
    kind,
    amount: '',
    categoryId: categoryId || activeCategories.find((category) => category.kind === kind)?.id || '',
    account: data.accounts[0]?.id ?? 'cash',
    note: '',
  });

  const openMovement = (movement: Data['movements'][number]) => {
    setCell(null);
    updateDraft({ id: movement.id, date: movement.date, kind: movement.kind as 'income' | 'expense', amount: String(movement.amount), categoryId: movement.categoryId ?? '', account: (movement.kind === 'income' ? movement.toAccount : movement.account) ?? 'cash', note: movement.note });
  };

  const openCell = (date: string, category: Category) => {
    const movements = movementsForCell(category.id, date);
    if (movements.length === 1) return openMovement(movements[0]);
    if (movements.length > 1) return setCell({ date, category });
    updateDraft(makeDraft(category.kind, date, category.id));
  };

  const saveMovement = async () => {
    if (!draft) return;
    const amount = parseBudgetAmount(draft.amount);
    if (amount === null) return setMovementError('Ingresa un monto positivo con hasta 2 decimales.');
    if (!isValidMovementDate(draft.date)) return setMovementError('Elige una fecha válida.');
    if (!activeCategories.some((category) => category.id === draft.categoryId && category.kind === draft.kind)) return setMovementError('Elige un rubro activo del tipo seleccionado.');
    if (!data.accounts.some((account) => account.id === draft.account)) return setMovementError('Elige una cuenta válida.');
    const movement = {
      ...(draft.id ? { id: draft.id } : {}),
      date: draft.date,
      kind: draft.kind,
      amount,
      categoryId: draft.categoryId,
      ...(draft.kind === 'income' ? { toAccount: draft.account } : { account: draft.account }),
      note: draft.note.trim(),
    };
    if (!await runChange(() => saveMovementRequest(movement), 'Movimiento guardado')) return;
    updateDraft(null);
    setCell(null);
  };

  const saveTransfer = async () => {
    if (!transfer || !transfer.amount || Number(transfer.amount) <= 0 || transfer.account === transfer.toAccount) return;
    const movement = { date: transfer.date, kind: 'transfer' as const, amount: Number(transfer.amount), account: transfer.account, toAccount: transfer.toAccount, note: transfer.note.trim() };
    await runChange(() => saveMovementRequest(movement), transferMode === 'withdrawal' ? 'Retiro guardado' : 'Transferencia guardada');
    setTransfer(null);
  };

  const removeMovement = (id: string) => {
    void runChange(() => deleteMovementRequest(id), 'Movimiento eliminado');
  };

  const saveCategories = (categories: Category[]) => {
    void runChange(() => saveCategoriesRequest(categories), 'Rubros guardados');
  };

  const saveBalances = async () => {
    if (newAccountName.trim() && (!newAccountBalance.trim() || !Number.isFinite(Number(newAccountBalance)))) {
      setToast('Revisa el saldo de la nueva cuenta.');
      return;
    }
    try {
      await Promise.all(data.accounts.map((account) => {
        const draft = accountDrafts[account.id] ?? { name: account.name, balance: String(account.openingBalance) };
        const openingBalance = draft.balance.trim() ? Number(draft.balance) : Number.NaN;
        if (!Number.isFinite(openingBalance)) throw new Error(`Revisa el saldo de ${account.name}.`);
        return account.kind === 'cash'
          ? saveOpeningBalance(account.id, openingBalance)
          : saveAccount({ id: account.id, name: draft.name, openingBalance });
      }));
      if (newAccountName.trim()) await createBankAccount({ name: newAccountName.trim(), openingBalance: Number(newAccountBalance), startDate: localDate(new Date()) });
      await refreshData();
      setNewAccountName('');
      setNewAccountBalance('0');
      setBalanceOpen(false);
      setToast('Cuentas guardadas');
    } catch (error) {
      await refreshData().catch(() => undefined);
      setToast(error instanceof Error ? error.message : 'No se pudieron guardar las cuentas.');
    }
  };

  const changePassword = async () => {
    setPasswordSaving(true);
    setPasswordError('');
    try {
      await changeWebPassword(passwordDraft.current, passwordDraft.next, passwordDraft.confirm);
      setPasswordOpen(false);
      onPasswordChanged();
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const startTransfer = () => {
    setTransferMode('transfer');
    setTransfer({ date: localDate(new Date()), amount: '', account: data.accounts[0]?.id ?? 'cash', toAccount: bankAccounts[0]?.id ?? 'bank', note: '' });
  };

  const startWithdrawal = () => {
    if (!bankAccounts.length) {
      setToast('Agrega una cuenta bancaria antes de retirar.');
      return;
    }
    setTransferMode('withdrawal');
    setTransfer({ date: localDate(new Date()), amount: '', account: bankAccounts[0].id, toAccount: data.accounts.find((account) => account.kind === 'cash')?.id ?? 'cash', note: '' });
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
            <button type="button" className="navigation-toggle" aria-label="Abrir menú de navegación" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}><span aria-hidden="true">☰</span></button>
            <a className="brand-mark" href="#inicio" aria-label="Estados financieros"><span>ef</span></a>
            <div className="brand-copy"><strong>Estados financieros</strong><span>Tu mes, claro y en orden</span></div>
            <div className="top-actions">
              <ThemeToggle mode={themeMode} onToggle={onThemeToggle} />
              <IonButton fill="outline" className="quiet-button" onClick={() => { setAccountDrafts(Object.fromEntries(data.accounts.map((account) => [account.id, { name: account.name, balance: String(account.openingBalance) }]))); setBalanceOpen(true); }}><IonIcon slot="start" icon={walletOutline} /><span className="action-label">Cuentas y saldos</span></IonButton>
              <IonButton fill="outline" className="quiet-button" onClick={() => setCategoryOpen('expense')}><IonIcon slot="start" icon={createOutline} /><span className="action-label">Rubros</span></IonButton>
              <IonButton fill="outline" className="quiet-button" onClick={startTransfer} disabled={!bankAccounts.length}><IonIcon slot="start" icon={swapHorizontalOutline} /><span className="action-label">Transferir</span></IonButton>
              <IonButton fill="outline" className="quiet-button" onClick={startWithdrawal} disabled={!bankAccounts.length}><IonIcon slot="start" icon={cashOutline} /><span className="action-label">Retirar</span></IonButton>
              <IonButton className="add-button" onClick={() => updateDraft(makeDraft('expense'))}><IonIcon slot="start" icon={addOutline} /><span className="action-label">Registrar</span></IonButton>
              <IonButton fill="outline" className="quiet-button" onClick={() => { setPasswordDraft({ current: '', next: '', confirm: '' }); setPasswordError(''); setPasswordOpen(true); }}><IonIcon slot="start" icon={lockClosedOutline} /><span className="action-label">Cambiar contraseña</span></IonButton>
              <IonButton fill="outline" className="quiet-button" onClick={onLogout}><IonIcon slot="start" icon={logOutOutline} /><span className="action-label">Cerrar sesión</span></IonButton>
            </div>
          </header>

          <div className="finance-layout">
            <FinanceSidebar selected={section} open={navigationOpen} onSelect={(next) => { setSection(next); setNavigationOpen(false); }} onClose={() => setNavigationOpen(false)} />
            <div className="main-content">
          {loading && <div className="connection-banner"><IonSpinner name="crescent" /> Cargando tus datos…</div>}
          {apiError && <div className="connection-banner connection-error"><span>{apiError} Comprueba tu conexión e inténtalo de nuevo.</span><IonButton size="small" fill="outline" onClick={() => { setLoading(true); void refreshData().catch((error: unknown) => setApiError(error instanceof Error ? error.message : 'No se pudo conectar al servidor.')).finally(() => setLoading(false)); }}>Reintentar</IonButton></div>}

          {section === 'ledger' ? <>
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
                {[{ id: 'all', name: 'Todo' }, ...data.accounts].map((account) => <button key={account.id} className={filter === account.id ? 'selected' : ''} onClick={() => setFilter(account.id)}>{account.name}</button>)}
              </div>
            </div>
          </section>

          <section className="summary-strip" aria-label="Resumen del mes">
            <article className="summary-item income-summary"><span>Ingresos del mes</span><strong>{money.format(incomeTotal)}</strong><small><IonIcon icon={arrowBackOutline} /> Entradas registradas</small></article>
            <article className="summary-item expense-summary"><span>Gastos del mes</span><strong>{money.format(expenseTotal)}</strong><small><IonIcon icon={arrowForwardOutline} /> Salidas registradas</small></article>
            <article className="summary-item net-summary"><span>Balance del mes</span><strong>{money.format(incomeTotal - expenseTotal)}</strong><small>Ingresos menos gastos</small></article>
            <article className="accounts-summary"><span>Disponible al cierre</span><div>{data.accounts.map((account) => <p key={account.id}><span><i className={`account-dot ${account.kind}`} />{account.name}</span><strong>{money.format(balanceAt(account.id))}</strong></p>)}<p className="debit-total"><span>Total Débito</span><strong>{money.format(bankAccounts.reduce((total, account) => total + balanceAt(account.id), 0))}</strong></p></div></article>
          </section>

          <section className="sheet-section">
            <div className="sheet-heading">
              <div><h2>{monthLabel(month)}</h2><p>Haz clic en una celda para editar o agregar movimientos.</p></div>
              <span className="sheet-hint"><IonIcon icon={cashOutline} /> Valores en USD</span>
            </div>
            <div className="sheet-scroll" role="region" aria-label="Tabla mensual de ingresos y gastos" tabIndex={0}>
              <table className="ledger">
                <thead>
                  <tr><th className="category-column">Rubro</th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); return <th key={date} className={`day-heading ${isWeekend(date) ? 'weekend-heading' : ''}`}><span>{new Intl.DateTimeFormat('es-EC', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '')}</span><strong>{index + 1}</strong></th>; })}<th className="total-heading">Total</th></tr>
                </thead>
                <tbody>
                  <tr className="section-row income-section"><th colSpan={days + 2}>Ingresos <span>· {money.format(incomeTotal)}</span><button onClick={() => setCategoryOpen('income')} aria-label="Agregar rubro de ingreso"><IonIcon icon={addOutline} /></button></th></tr>
                  {activeCategories.filter((category) => category.kind === 'income').map((category) => <tr className="category-row income-row" key={category.id}><th className="category-column"><span>{category.name}</span><small>Ingreso</small></th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); const amount = totalForCell(category.id, date); return <td key={date} className={isWeekend(date) ? 'weekend-cell' : undefined}><button className={`cell-value ${amount ? 'has-value' : ''}`} onClick={() => openCell(date, category)} title={amount ? 'Clic para editar' : 'Clic para registrar'} aria-label={`${amount ? 'Editar' : 'Registrar'} ${category.name}, día ${index + 1}, ${money.format(amount)}`}>{amount ? money.format(amount) : <span className="empty-cell">·</span>}</button></td>; })}<td className="row-total">{money.format(Array.from({ length: days }, (_, index) => totalForCell(category.id, dateForMonth(month, index + 1))).reduce((sum, amount) => sum + amount, 0))}</td></tr>)}
                  <tr className="daily-total income-daily"><th className="category-column">Total ingresos</th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); return <td key={date} className={isWeekend(date) ? 'weekend-cell' : undefined}>{money.format(visibleMovements.filter((movement) => movement.kind === 'income' && movement.date === date).reduce((sum, movement) => sum + movement.amount, 0))}</td>; })}<td className="row-total">{money.format(incomeTotal)}</td></tr>
                  <tr className="section-row expense-section"><th colSpan={days + 2}>Gastos <span>· {money.format(expenseTotal)}</span><button onClick={() => setCategoryOpen('expense')} aria-label="Agregar rubro de gasto"><IonIcon icon={addOutline} /></button></th></tr>
                  {activeCategories.filter((category) => category.kind === 'expense').map((category) => <tr className="category-row expense-row" key={category.id}><th className="category-column"><span>{category.name}</span><small>Gasto</small></th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); const amount = totalForCell(category.id, date); return <td key={date} className={isWeekend(date) ? 'weekend-cell' : undefined}><button className={`cell-value ${amount ? 'has-value' : ''}`} onClick={() => openCell(date, category)} title={amount ? 'Clic para editar' : 'Clic para registrar'} aria-label={`${amount ? 'Editar' : 'Registrar'} ${category.name}, día ${index + 1}, ${money.format(amount)}`}>{amount ? money.format(amount) : <span className="empty-cell">·</span>}</button></td>; })}<td className="row-total">{money.format(Array.from({ length: days }, (_, index) => totalForCell(category.id, dateForMonth(month, index + 1))).reduce((sum, amount) => sum + amount, 0))}</td></tr>)}
                  <tr className="daily-total expense-daily"><th className="category-column">Total gastos</th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); return <td key={date} className={isWeekend(date) ? 'weekend-cell' : undefined}>{money.format(visibleMovements.filter((movement) => movement.kind === 'expense' && movement.date === date).reduce((sum, movement) => sum + movement.amount, 0))}</td>; })}<td className="row-total">{money.format(expenseTotal)}</td></tr>
                  <tr className="net-daily"><th className="category-column">Balance diario</th>{Array.from({ length: days }, (_, index) => { const date = dateForMonth(month, index + 1); const total = visibleMovements.filter((movement) => movement.date === date); return <td key={date} className={isWeekend(date) ? 'weekend-cell' : undefined}>{money.format(total.filter((movement) => movement.kind === 'income').reduce((sum, movement) => sum + movement.amount, 0) - total.filter((movement) => movement.kind === 'expense').reduce((sum, movement) => sum + movement.amount, 0))}</td>; })}<td className="row-total">{money.format(incomeTotal - expenseTotal)}</td></tr>
                </tbody>
              </table>
            </div>
            <footer className="sheet-footer"><span>Datos guardados en tu cuenta.</span><span><i className="account-dot cash" /> Efectivo <i className="account-dot bank" /> Débito</span></footer>
          </section>
          </> : section === 'budget' ? <BudgetPage data={data} month={month} onMonthChange={setMonth} />
            : section === 'analysis' ? <AnalysisPage data={data} month={month} onMonthChange={setMonth} />
              : section === 'balance-sheet' ? <BalanceSheetPage data={data} asOfDate={balanceAsOfDate} onAsOfDateChange={setBalanceAsOfDate} />
                : <CashFlowPage data={data} startDate={cashFlowStartDate} endDate={cashFlowEndDate} onStartDateChange={setCashFlowStartDate} onEndDateChange={setCashFlowEndDate} />}
            </div>
          </div>
        </main>
      </IonContent>

      <IonModal isOpen={!!draft} onDidDismiss={() => updateDraft(null)} className="form-modal">
        <div className="modal-shell">
          <div className="modal-heading"><div><span className="modal-kicker">MOVIMIENTO</span><h2>{draft?.id ? 'Editar movimiento' : draft?.kind === 'income' ? 'Registrar ingreso' : 'Registrar gasto'}</h2></div><button className="icon-close" onClick={() => updateDraft(null)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></div>
          {draft && <div className="form-fields">
            <div className="kind-switch"><button className={draft.kind === 'income' ? 'active income-active' : ''} onClick={() => updateDraft({ ...draft, kind: 'income', categoryId: activeCategories.find((category) => category.kind === 'income')?.id ?? '' })}>Ingreso</button><button className={draft.kind === 'expense' ? 'active expense-active' : ''} onClick={() => updateDraft({ ...draft, kind: 'expense', categoryId: activeCategories.find((category) => category.kind === 'expense')?.id ?? '' })}>Gasto</button></div>
            <IonItem className="form-item"><IonInput label="Monto" labelPlacement="stacked" type="number" min="0.01" step="0.01" placeholder="0,00" value={draft.amount} onIonInput={(event) => updateDraft({ ...draft, amount: String(event.detail.value ?? '') })} /></IonItem>
            <IonItem className="form-item"><IonSelect label="Rubro" labelPlacement="stacked" interface="popover" value={draft.categoryId} onIonChange={(event) => updateDraft({ ...draft, categoryId: event.detail.value })}>{activeCategories.filter((category) => category.kind === draft.kind).map((category) => <IonSelectOption key={category.id} value={category.id}>{category.name}</IonSelectOption>)}</IonSelect></IonItem>
            <IonItem className="form-item"><IonSelect label={draft.kind === 'income' ? 'Recibir en' : 'Pagar con'} labelPlacement="stacked" interface="popover" value={draft.account} onIonChange={(event) => updateDraft({ ...draft, account: event.detail.value })}>{data.accounts.map((account) => <IonSelectOption key={account.id} value={account.id}>{account.name}</IonSelectOption>)}</IonSelect></IonItem>
            <IonItem className="form-item"><IonInput label="Fecha" labelPlacement="stacked" type="date" value={draft.date} onIonInput={(event) => updateDraft({ ...draft, date: String(event.detail.value ?? '') })} /></IonItem>
            <IonItem className="form-item note-item"><IonTextarea label="Descripción (opcional)" labelPlacement="stacked" autoGrow rows={2} value={draft.note} onIonInput={(event) => updateDraft({ ...draft, note: String(event.detail.value ?? '') })} /></IonItem>
            {movementError && <div role="alert" className="login-error movement-validation">{movementError}</div>}<div className="modal-actions">{draft.id && <IonButton fill="clear" color="danger" onClick={() => { removeMovement(draft.id!); updateDraft(null); }}>Eliminar</IonButton>}<IonButton fill="outline" onClick={() => updateDraft(null)}>Cancelar</IonButton><IonButton onClick={saveMovement}>Guardar</IonButton></div>
          </div>}
        </div>
      </IonModal>

      <IonModal isOpen={!!cell} onDidDismiss={() => setCell(null)} className="form-modal">
        <div className="modal-shell cell-modal">
          <div className="modal-heading"><div><span className="modal-kicker">{cell?.category.kind === 'income' ? 'INGRESOS' : 'GASTOS'} · {cell?.date}</span><h2>{cell?.category.name}</h2></div><button className="icon-close" onClick={() => setCell(null)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></div>
          {cell && <>
            <div className="cell-movements">{categoryMovements.length ? categoryMovements.map((movement) => <article className="movement-line" key={movement.id}><div><strong>{money.format(movement.amount)}</strong><span>{accountName(movement.kind === 'income' ? movement.toAccount : movement.account, data.accounts)}{movement.note ? ` · ${movement.note}` : ''}</span></div><button aria-label="Editar movimiento" onClick={() => openMovement(movement)}><IonIcon icon={createOutline} /></button><button aria-label="Eliminar movimiento" onClick={() => removeMovement(movement.id)}><IonIcon icon={closeOutline} /></button></article>) : <p className="empty-state">No hay movimientos para este rubro y día.</p>}</div>
            <IonButton expand="block" onClick={() => { const next = makeDraft(cell.category.kind, cell.date, cell.category.id); setCell(null); updateDraft(next); }}><IonIcon slot="start" icon={addOutline} /> Agregar movimiento</IonButton>
          </>}
        </div>
      </IonModal>

      <CategoryManager open={categoryOpen !== null} initialKind={categoryOpen ?? 'expense'} categories={data.categories} onClose={() => setCategoryOpen(null)} onSave={saveCategories} />

      <IonModal isOpen={!!transfer} onDidDismiss={() => setTransfer(null)} className="form-modal">
        <div className="modal-shell"><div className="modal-heading"><div><span className="modal-kicker">{transferMode === 'withdrawal' ? 'BANCO A EFECTIVO' : 'ENTRE TUS CUENTAS'}</span><h2>{transferMode === 'withdrawal' ? 'Retirar efectivo' : 'Transferir dinero'}</h2></div><button className="icon-close" onClick={() => setTransfer(null)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></div>
          {transfer && <div className="form-fields"><p className="helper-copy">El traslado cambia los saldos, pero no cuenta como ingreso ni gasto.</p>
            <IonItem className="form-item"><IonInput label="Monto" labelPlacement="stacked" type="number" min="0.01" step="0.01" placeholder="0,00" value={transfer.amount} onIonInput={(event) => setTransfer({ ...transfer, amount: String(event.detail.value ?? '') })} /></IonItem>
            <IonItem className="form-item"><IonSelect label="Desde" labelPlacement="stacked" value={transfer.account} onIonChange={(event) => setTransfer({ ...transfer, account: event.detail.value })}>{(transferMode === 'withdrawal' ? bankAccounts : data.accounts).map((account) => <IonSelectOption key={account.id} value={account.id}>{account.name}</IonSelectOption>)}</IonSelect></IonItem>
            {transferMode === 'withdrawal' ? <IonItem className="form-item"><IonInput label="Hacia" labelPlacement="stacked" readonly value="Efectivo" /></IonItem> : <IonItem className="form-item"><IonSelect label="Hacia" labelPlacement="stacked" value={transfer.toAccount} onIonChange={(event) => setTransfer({ ...transfer, toAccount: event.detail.value })}>{data.accounts.map((account) => <IonSelectOption key={account.id} value={account.id}>{account.name}</IonSelectOption>)}</IonSelect></IonItem>}
            <IonItem className="form-item"><IonInput label="Fecha" labelPlacement="stacked" type="date" value={transfer.date} onIonInput={(event) => setTransfer({ ...transfer, date: String(event.detail.value ?? '') })} /></IonItem>
            <IonItem className="form-item"><IonInput label="Descripción (opcional)" labelPlacement="stacked" value={transfer.note} onIonInput={(event) => setTransfer({ ...transfer, note: String(event.detail.value ?? '') })} /></IonItem>
            <div className="modal-actions"><IonButton fill="outline" onClick={() => setTransfer(null)}>Cancelar</IonButton><IonButton onClick={saveTransfer} disabled={transfer.account === transfer.toAccount}>{transferMode === 'withdrawal' ? 'Guardar retiro' : 'Guardar transferencia'}</IonButton></div>
          </div>}
        </div>
      </IonModal>

      <IonModal isOpen={balanceOpen} onDidDismiss={() => setBalanceOpen(false)} className="form-modal">
        <div className="modal-shell"><div className="modal-heading"><div><span className="modal-kicker">PUNTO DE PARTIDA</span><h2>Saldos iniciales</h2></div><button className="icon-close" onClick={() => setBalanceOpen(false)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></div>
          <p className="helper-copy balance-copy">Registra cuánto tenías al comenzar a usar la app. Los movimientos actualizarán estos saldos.</p>
          <div className="form-fields">{data.accounts.map((account) => <div key={account.id}><IonItem className="form-item">{account.kind === 'bank' ? <IonInput label="Nombre o referencia de cuenta" labelPlacement="stacked" value={accountDrafts[account.id]?.name ?? account.name} onIonInput={(event) => setAccountDrafts((current) => ({ ...current, [account.id]: { name: String(event.detail.value ?? ''), balance: current[account.id]?.balance ?? String(account.openingBalance) } }))} /> : <IonInput label="Efectivo" labelPlacement="stacked" readonly value={account.name} />}</IonItem><IonItem className="form-item"><IonInput label={`Saldo inicial · desde ${account.startDate}`} labelPlacement="stacked" type="number" step="0.01" value={accountDrafts[account.id]?.balance ?? String(account.openingBalance)} onIonInput={(event) => setAccountDrafts((current) => ({ ...current, [account.id]: { name: current[account.id]?.name ?? account.name, balance: String(event.detail.value ?? '') } }))} /></IonItem></div>)}
            <div className="new-account-fields"><IonItem className="form-item"><IonInput label="Nueva cuenta bancaria" labelPlacement="stacked" placeholder="Banco o número de cuenta" value={newAccountName} onIonInput={(event) => setNewAccountName(String(event.detail.value ?? ''))} /></IonItem><IonItem className="form-item"><IonInput label={`Saldo inicial · desde ${localDate(new Date())}`} labelPlacement="stacked" type="number" step="0.01" value={newAccountBalance} onIonInput={(event) => setNewAccountBalance(String(event.detail.value ?? ''))} /></IonItem></div>
            <div className="modal-actions"><IonButton fill="outline" onClick={() => setBalanceOpen(false)}>Cancelar</IonButton><IonButton onClick={saveBalances}>Guardar cuentas</IonButton></div></div>
        </div>
      </IonModal>
      <IonModal isOpen={passwordOpen} onDidDismiss={() => setPasswordOpen(false)} className="form-modal">
        <div className="modal-shell"><div className="modal-heading"><div><span className="modal-kicker">SEGURIDAD</span><h2>Cambiar contraseña</h2></div><button className="icon-close" onClick={() => setPasswordOpen(false)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></div>
          <div className="form-fields"><IonItem className="form-item"><IonInput label="Contraseña actual" labelPlacement="stacked" type="password" autocomplete="current-password" value={passwordDraft.current} onIonInput={(event) => setPasswordDraft({ ...passwordDraft, current: String(event.detail.value ?? '') })} /></IonItem><IonItem className="form-item"><IonInput label="Nueva contraseña" labelPlacement="stacked" type="password" autocomplete="new-password" value={passwordDraft.next} onIonInput={(event) => setPasswordDraft({ ...passwordDraft, next: String(event.detail.value ?? '') })} /></IonItem><IonItem className="form-item"><IonInput label="Confirmar contraseña nueva" labelPlacement="stacked" type="password" autocomplete="new-password" value={passwordDraft.confirm} onIonInput={(event) => setPasswordDraft({ ...passwordDraft, confirm: String(event.detail.value ?? '') })} /></IonItem>{passwordError && <p className="form-error">{passwordError}</p>}<div className="modal-actions"><IonButton fill="outline" onClick={() => setPasswordOpen(false)} disabled={passwordSaving}>Cancelar</IonButton><IonButton onClick={() => void changePassword()} disabled={passwordSaving}>{passwordSaving ? 'Guardando…' : 'Cambiar contraseña'}</IonButton></div></div>
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
