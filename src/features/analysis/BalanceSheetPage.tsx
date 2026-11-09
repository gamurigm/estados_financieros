import type { FinanceState } from '../../api';
import { getBalanceSheet } from './selectors';
import { useState } from 'react';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const formatDate = (date: string) => new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date(`${date}T12:00:00`));

export function BalanceSheetPage({ data, asOfDate, onAsOfDateChange, onTransfer }: {
  data: FinanceState;
  asOfDate: string;
  onAsOfDateChange: (date: string) => void;
  onTransfer: (accountId: string) => void;
}) {
  const [amountBlurred, setAmountBlurred] = useState(false);
  const report = getBalanceSheet(data, asOfDate);

  return <section>
    <header className="month-heading feature-heading report-heading">
      <div><p className="eyebrow">POSICIÓN FINANCIERA</p><h1>Balance general</h1><p className="heading-note">Saldos de efectivo y bancos en la fecha elegida.</p></div>
      <label className="report-date-field"><span>Fecha de corte</span><input aria-label="Fecha de corte del balance general" type="date" value={asOfDate} onChange={(event) => onAsOfDateChange(event.target.value)} /></label>
    </header>
    {!report ? <p className="report-validation">Elige una fecha válida para consultar el balance.</p> : <>
      <div className="statement-layout">
        <section className="statement-hero">
          <span className="statement-icon" aria-hidden="true">◈</span>
          <p className="statement-kicker">Activos líquidos registrados</p>
          <div className="statement-total-row"><strong className={`statement-total${amountBlurred ? ' is-blurred' : ''}`}>{currency.format(report.total)}</strong><button className="statement-privacy-toggle" type="button" aria-pressed={amountBlurred} aria-label={amountBlurred ? 'Mostrar activos líquidos' : 'Desenfocar activos líquidos'} onClick={() => setAmountBlurred((value) => !value)}>{amountBlurred ? 'Mostrar' : 'Ocultar'}</button></div>
          <span className="statement-date">Al {formatDate(report.asOfDate)}</span>
        </section>
        <section className="analysis-panel statement-accounts">
          <div className="analysis-panel-heading"><div><h2>Efectivo y cuentas bancarias</h2><p>{report.accounts.length} {report.accounts.length === 1 ? 'cuenta' : 'cuentas'} activas en esta fecha</p></div></div>
          {report.accounts.length ? <><p className="statement-account-hint">Selecciona un banco para transferir o efectivo para depositar</p><div className="statement-account-list">{report.accounts.map((account) => <button className="statement-account-row" key={account.id} type="button" onClick={() => onTransfer(account.id)} aria-label={account.kind === 'cash' ? 'Depositar efectivo en una cuenta bancaria' : `Transferir desde ${account.name}`}>
            <span className={`statement-account-mark ${account.kind}`} aria-hidden="true">{account.kind === 'cash' ? 'E' : 'B'}</span>
            <div className="statement-account-copy"><strong>{account.name}</strong><span>{account.kind === 'cash' ? 'Efectivo' : 'Cuenta bancaria'}</span></div>
            <strong className={`statement-account-amount ${account.amount < 0 ? 'negative-value' : ''}`}>{currency.format(account.amount)}</strong>
          </button>)}</div></> : <p className="feature-empty">No hay cuentas registradas en esta fecha.</p>}
        </section>
      </div>
      <aside className="statement-disclosure"><span aria-hidden="true">i</span><p><strong>Pasivos y patrimonio no calculados</strong><small>La app no registra deudas ni otras obligaciones. Este balance usa solo saldos registrados y no proyecta fechas futuras.</small></p></aside>
    </>}
  </section>;
}
