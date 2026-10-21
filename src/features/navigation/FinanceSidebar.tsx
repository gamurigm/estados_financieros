import { useEffect, useRef } from 'react';

export type FinanceSection = 'ledger' | 'budget' | 'analysis' | 'balance-sheet' | 'cash-flow';

const sections: { id: FinanceSection; label: string; symbol: string }[] = [
  { id: 'ledger', label: 'Libro', symbol: '▤' },
  { id: 'budget', label: 'Presupuesto', symbol: '◷' },
  { id: 'analysis', label: 'Análisis', symbol: '▥' },
];

const reports: { id: FinanceSection; label: string; symbol: string }[] = [
  { id: 'balance-sheet', label: 'Balance general', symbol: '◈' },
  { id: 'cash-flow', label: 'Flujo de caja', symbol: '↗' },
];

export function FinanceSidebar({ selected, open, onSelect, onClose }: {
  selected: FinanceSection;
  open: boolean;
  onSelect: (section: FinanceSection) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLButtonElement>('.sidebar-link[aria-current="page"]')?.focus();
  }, [open]);

  const close = () => {
    onClose();
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 700px)').matches) document.querySelector<HTMLButtonElement>('.navigation-toggle')?.focus();
    });
  };

  const select = (section: FinanceSection) => {
    onSelect(section);
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 700px)').matches) document.querySelector<HTMLButtonElement>('.navigation-toggle')?.focus();
    });
  };

  return <>
    {open && <button className="sidebar-backdrop" onClick={close} aria-label="Cerrar menú" />}
    <aside ref={panel} className={`finance-sidebar ${open ? 'is-open' : ''}`} aria-label="Secciones financieras">
      <p className="sidebar-title">Finanzas</p>
      <nav className="sidebar-links">
        {sections.map((section) => <button key={section.id} className={`sidebar-link ${selected === section.id ? 'selected' : ''}`} aria-current={selected === section.id ? 'page' : undefined} onClick={() => select(section.id)}>
          <span className="sidebar-symbol" aria-hidden="true">{section.symbol}</span><span>{section.label}</span>
        </button>)}
        <div className="sidebar-divider" />
        {reports.map((section) => <button key={section.id} className={`sidebar-link ${selected === section.id ? 'selected' : ''}`} aria-current={selected === section.id ? 'page' : undefined} onClick={() => select(section.id)}>
          <span className="sidebar-symbol" aria-hidden="true">{section.symbol}</span><span>{section.label}</span>
        </button>)}
      </nav>
      <button className="sidebar-close" onClick={close} aria-label="Cerrar menú">×</button>
    </aside>
  </>;
}
