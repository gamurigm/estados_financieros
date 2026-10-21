import type { FinanceState } from '../../api';
import { getCashFlow } from './selectors';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const formatDate = (date: string) => new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`));

export function CashFlowPage({ data, startDate, endDate, onStartDateChange, onEndDateChange }: {
  data: FinanceState;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}) {
  const report = getCashFlow(data, startDate, endDate);
  const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]));
  const accountNames = new Map(data.accounts.map((account) => [account.id, account.name]));

  return <section>
    <header className="month-heading feature-heading report-heading">
      <div><p className="eyebrow">MOVIMIENTO DE DINERO</p><h1>Flujo de caja</h1><p className="heading-note">Consulta entradas y salidas en cualquier período.</p></div>
      <div className="report-date-range">
        <label className="report-date-field"><span>Desde</span><input aria-label="Fecha inicial del flujo de caja" type="date" value={startDate} onChange={(event) => onStartDateChange(event.target.value)} /></label>
        <label className="report-date-field"><span>Hasta</span><input aria-label="Fecha final del flujo de caja" type="date" value={endDate} onChange={(event) => onEndDateChange(event.target.value)} /></label>
      </div>
    </header>
    {!report ? <p className="report-validation">Revisa las fechas. El rango debe ser válido y la fecha inicial no puede superar la final.</p> : <>
      <section className={`flow-hero ${report.netFlow < 0 ? 'is-negative' : ''}`}>
        <div><p className="flow-kicker">Flujo neto del período</p><strong>{currency.format(report.netFlow)}</strong><span>Ingresos menos gastos registrados</span></div>
        <div className="flow-hero-mark" aria-hidden="true">{report.netFlow < 0 ? '↘' : '↗'}</div>
      </section>
      <section className="cashflow-summary" aria-label="Resumen del flujo de caja">
        <article className="analysis-metric"><span>Saldo inicial</span><strong>{currency.format(report.openingBalance)}</strong><small>Antes del {formatDate(report.startDate)}</small></article>
        <article className="analysis-metric income-metric"><span>Ingresos</span><strong>{currency.format(report.income)}</strong><small>Entradas registradas</small></article>
        <article className="analysis-metric expense-metric"><span>Gastos</span><strong>{currency.format(report.expenses)}</strong><small>Salidas registradas</small></article>
        <article className="analysis-metric balance-metric"><span>Saldo al cierre</span><strong>{currency.format(report.closingBalance)}</strong><small>Al {formatDate(report.endDate)}</small></article>
      </section>
      <div className="flow-detail-layout">
        <section className="analysis-panel flow-movements">
          <div className="analysis-panel-heading"><div><h2>Movimientos del período</h2><p>{report.movements.length} {report.movements.length === 1 ? 'movimiento' : 'movimientos'} incluidos</p></div></div>
          {report.movements.length ? <div className="flow-movement-list">{report.movements.map((movement) => {
            const income = movement.kind === 'income';
            const category = movement.categoryId ? categoryNames.get(movement.categoryId) : undefined;
            const accountId = income ? movement.toAccount : movement.account;
            return <article className={`flow-movement ${income ? 'income' : 'expense'}`} key={movement.id}>
              <span className="flow-movement-mark" aria-hidden="true">{income ? '↙' : '↗'}</span>
              <div className="flow-movement-copy"><strong>{category ?? (income ? 'Ingreso' : 'Gasto')}</strong><span>{movement.note || accountNames.get(accountId ?? '') || 'Sin descripción'} · {formatDate(movement.date)}</span></div>
              <strong className="flow-movement-amount">{income ? '+' : '−'}{currency.format(movement.amount)}</strong>
            </article>;
          })}</div> : <p className="feature-empty">No hay ingresos ni gastos en este período. Las transferencias quedan fuera del flujo.</p>}
        </section>
        <aside className="flow-note"><span aria-hidden="true">⇄</span><div><strong>Transferencias excluidas</strong><p>Los movimientos entre tus cuentas cambian el saldo de cada cuenta, pero no cuentan como ingreso ni gasto del conjunto. El saldo final puede incluir saldos iniciales de cuentas creadas dentro del período. Las fechas futuras no son proyecciones.</p></div></aside>
      </div>
    </>}
  </section>;
}
