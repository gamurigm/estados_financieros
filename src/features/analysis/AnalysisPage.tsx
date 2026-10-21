import type { FinanceState } from '../../api';
import { getExpenseCategoryBreakdown, getMonthlyTrend } from './selectors';
import { MonthNavigator } from '../ledger/MonthNavigator';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const shortCurrency = new Intl.NumberFormat('es-EC', { notation: 'compact', maximumFractionDigits: 1 });
const formatMonth = (month: string) => new Intl.DateTimeFormat('es-EC', { month: 'short' }).format(new Date(`${month}-01T12:00:00`)).replace('.', '');

export function AnalysisPage({ data, month, onMonthChange }: { data: FinanceState; month: string; onMonthChange: (month: string) => void }) {
  const trend = getMonthlyTrend(data, month);
  const categories = getExpenseCategoryBreakdown(data, month);
  const selected = trend[trend.length - 1];
  const maximum = Math.max(1, ...trend.flatMap((item) => [item.income, item.expenses]));
  const maxCategory = Math.max(1, ...categories.map((item) => item.amount));

  return <section>
    <header className="month-heading feature-heading">
      <div><p className="eyebrow">TUS NÚMEROS</p><h1>Análisis</h1><p className="heading-note">Compara ingresos, gastos y rubros en el tiempo.</p></div>
      <MonthNavigator month={month} onChange={onMonthChange} />
    </header>
    <section className="analysis-summary" aria-label={`Resumen de ${month}`}>
      <article className="analysis-metric income-metric"><span>Ingresos</span><strong>{currency.format(selected?.income ?? 0)}</strong></article>
      <article className="analysis-metric expense-metric"><span>Gastos</span><strong>{currency.format(selected?.expenses ?? 0)}</strong></article>
      <article className="analysis-metric balance-metric"><span>Balance</span><strong>{currency.format((selected?.income ?? 0) - (selected?.expenses ?? 0))}</strong></article>
    </section>
    <div className="analysis-layout">
      <section className="analysis-panel trend-panel">
        <div className="analysis-panel-heading"><div><h2>Ingresos y gastos</h2><p>Últimos seis meses · valores en USD</p></div><div className="chart-legend"><span><i className="legend-dot income-dot" />Ingresos</span><span><i className="legend-dot expense-dot" />Gastos</span></div></div>
        <div className="trend-chart" role="img" aria-label="Comparación mensual de ingresos y gastos de los últimos seis meses">
          {trend.map((item) => <div className="trend-column" key={item.month}>
            <div className="trend-bars">
              <span className="trend-bar income-bar" title={`Ingresos ${item.month}: ${currency.format(item.income)}`} style={{ height: `${item.income ? Math.max(3, item.income / maximum * 100) : 0}%` }} />
              <span className="trend-bar expense-bar" title={`Gastos ${item.month}: ${currency.format(item.expenses)}`} style={{ height: `${item.expenses ? Math.max(3, item.expenses / maximum * 100) : 0}%` }} />
            </div>
            <span className="trend-month">{formatMonth(item.month)}</span>
            <span className="trend-year">{item.month.slice(2, 4)}</span>
            <span className="visually-hidden">{item.month}: ingresos {currency.format(item.income)}, gastos {currency.format(item.expenses)}</span>
          </div>)}
        </div>
        <div className="chart-scale"><span>Máximo {shortCurrency.format(maximum)}</span><span>Transferencias excluidas</span></div>
      </section>
      <section className="analysis-panel category-panel">
        <div className="analysis-panel-heading"><div><h2>Gastos por rubro</h2><p>{new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`))}</p></div><strong className="category-total">{currency.format(selected?.expenses ?? 0)}</strong></div>
        {categories.length ? <div className="category-breakdown">{categories.map((item) => <div className="category-breakdown-row" key={item.categoryId}>
          <div className="category-breakdown-heading"><span>{item.name}</span><strong>{currency.format(item.amount)}</strong></div>
          <div className="category-track"><span style={{ width: `${item.amount / maxCategory * 100}%` }} /></div>
        </div>)}</div> : <p className="feature-empty">No hay gastos registrados en este mes.</p>}
      </section>
    </div>
  </section>;
}
