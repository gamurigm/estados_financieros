import { useMemo, useState } from 'react';
import type { FinanceState } from '../../api';
import { getCashFlow, getExpenseCategoryBreakdownForRange, getMonthlyTrend, getPreviousRange } from './selectors';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const shortCurrency = new Intl.NumberFormat('es-EC', { notation: 'compact', maximumFractionDigits: 1 });
const formatMonth = (month: string) => new Intl.DateTimeFormat('es-EC', { month: 'short' }).format(new Date(`${month}-01T12:00:00`)).replace('.', '');
const today = () => localDate(new Date());

export function AnalysisPage({ data }: { data: FinanceState }) {
  const currentDate = today();
  const [startDate, setStartDate] = useState(`${currentDate.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(currentDate);
  const report = useMemo(() => getCashFlow(data, startDate, endDate), [data, startDate, endDate]);
  const previousRange = useMemo(() => getPreviousRange(startDate, endDate), [startDate, endDate]);
  const previous = previousRange ? getCashFlow(data, previousRange.startDate, previousRange.endDate) : null;
  const categories = useMemo(() => getExpenseCategoryBreakdownForRange(data, startDate, endDate), [data, startDate, endDate]);
  const previousCategories = previousRange ? getExpenseCategoryBreakdownForRange(data, previousRange.startDate, previousRange.endDate) : [];
  const trend = getMonthlyTrend(data, endDate.slice(0, 7));
  const maximum = Math.max(1, ...trend.flatMap((item) => [item.income, item.expenses]));
  const maxCategory = Math.max(1, ...categories.map((item) => item.amount));
  const days = report ? dateDistance(report.startDate, report.endDate) + 1 : 1;
  const averageMonthly = report ? report.expenses / days * 30.4375 : 0;
  const expenseDelta = previous && previous.expenses > 0 ? (report!.expenses - previous.expenses) / previous.expenses * 100 : null;
  const currentMonthStart = `${currentDate.slice(0, 7)}-01`;
  const monthEnd = new Date(Number(currentDate.slice(0, 4)), Number(currentDate.slice(5, 7)), 0).getDate();
  const paceProjection = report && startDate === currentMonthStart && endDate === currentDate
    ? report.expenses / Number(currentDate.slice(8, 10)) * monthEnd : null;

  function chooseRange(preset: 'week' | 'month' | 'quarter') {
    const end = today();
    const start = preset === 'month' ? `${end.slice(0, 7)}-01` : shiftDays(end, preset === 'week' ? -6 : -89);
    setStartDate(start);
    setEndDate(end);
  }

  return <section>
    <header className="month-heading feature-heading analysis-heading">
      <div><p className="eyebrow">TUS NÚMEROS</p><h1>Análisis</h1><p className="heading-note">Entiende cómo se mueve tu dinero en cualquier período.</p></div>
      <div className="analysis-range">
        <label className="report-date-field"><span>Desde</span><input aria-label="Fecha inicial del análisis" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label className="report-date-field"><span>Hasta</span><input aria-label="Fecha final del análisis" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <div className="analysis-presets" aria-label="Período rápido">{([['week', '7 días'], ['month', 'Este mes'], ['quarter', '90 días']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => chooseRange(id)}>{label}</button>)}</div>
      </div>
    </header>
    {!report ? <p className="report-validation">Revisa las fechas. La fecha inicial debe ser igual o anterior a la final.</p> : <>
      <section className="analysis-summary" aria-label="Resumen del período">
        <article className="analysis-metric income-metric"><span>Ingresos del período</span><strong>{currency.format(report.income)}</strong></article>
        <article className="analysis-metric expense-metric"><span>Gastos del período</span><strong>{currency.format(report.expenses)}</strong></article>
        <article className="analysis-metric balance-metric"><span>Disponible después de gastos</span><strong>{currency.format(report.netFlow)}</strong></article>
      </section>
      <section className="analysis-insights" aria-label="Hallazgos del período">
        <article><span>Promedio mensual equivalente</span><strong>{currency.format(averageMonthly)}</strong><small>Calculado al ritmo diario de este rango</small></article>
        <article><span>Gastos vs. período anterior</span><strong className={expenseDelta !== null && expenseDelta > 0 ? 'insight-up' : 'insight-down'}>{expenseDelta === null ? 'Sin base previa' : `${expenseDelta > 0 ? '+' : ''}${expenseDelta.toFixed(1)}%`}</strong><small>{previousRange ? `${formatDate(previousRange.startDate)} – ${formatDate(previousRange.endDate)}` : 'Selecciona un rango válido'}</small></article>
        <article><span>Ahorro sobre ingresos</span><strong>{report.income > 0 ? `${(report.netFlow / report.income * 100).toFixed(1)}%` : '—'}</strong><small>Ingresos menos gastos</small></article>
        {paceProjection !== null ? <article><span>Proyección al cierre del mes</span><strong>{currency.format(paceProjection)}</strong><small>Si mantienes este ritmo de gasto</small></article> : null}
      </section>
      <div className="analysis-layout">
        <section className="analysis-panel trend-panel">
          <div className="analysis-panel-heading"><div><h2>Ingresos y gastos</h2><p>Últimos seis meses · valores en USD</p></div><div className="chart-legend"><span><i className="legend-dot income-dot" />Ingresos</span><span><i className="legend-dot expense-dot" />Gastos</span></div></div>
          <div className="trend-chart" role="img" aria-label="Comparación mensual de ingresos y gastos de los últimos seis meses">
            {trend.map((item) => <div className="trend-column" key={item.month}>
              <div className="trend-bars"><span className="trend-bar income-bar" title={`Ingresos ${item.month}: ${currency.format(item.income)}`} style={{ height: `${item.income ? Math.max(3, item.income / maximum * 100) : 0}%` }} /><span className="trend-bar expense-bar" title={`Gastos ${item.month}: ${currency.format(item.expenses)}`} style={{ height: `${item.expenses ? Math.max(3, item.expenses / maximum * 100) : 0}%` }} /></div>
              <span className="trend-month">{formatMonth(item.month)}</span><span className="trend-year">{item.month.slice(2, 4)}</span>
            </div>)}
          </div>
          <div className="chart-scale"><span>Máximo {shortCurrency.format(maximum)}</span><span>Transferencias excluidas</span></div>
        </section>
        <section className="analysis-panel category-panel">
          <div className="analysis-panel-heading"><div><h2>Gastos por rubro</h2><p>{formatDate(startDate)} – {formatDate(endDate)}</p></div><strong className="category-total">{currency.format(report.expenses)}</strong></div>
          {categories.length ? <div className="category-breakdown">{categories.map((item) => {
            const oldAmount = previousCategories.find((previousItem) => previousItem.categoryId === item.categoryId)?.amount ?? 0;
            const change = oldAmount ? (item.amount - oldAmount) / oldAmount * 100 : null;
            return <div className="category-breakdown-row" key={item.categoryId}><div className="category-breakdown-heading"><span>{item.name}</span><strong>{currency.format(item.amount)}</strong></div><div className="category-track"><span style={{ width: `${item.amount / maxCategory * 100}%` }} /></div><small className="category-change">{change === null ? 'Nuevo en este período' : `${change > 0 ? '+' : ''}${change.toFixed(0)}% vs. período anterior`}</small></div>;
          })}</div> : <p className="feature-empty">No hay gastos registrados en estas fechas.</p>}
        </section>
      </div>
    </>}
  </section>;
}

function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function shiftDays(date: string, offset: number) { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + offset); return localDate(value); }
function dateDistance(start: string, end: string) { return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000); }
function formatDate(date: string) { return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`)); }
