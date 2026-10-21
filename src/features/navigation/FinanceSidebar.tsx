import { useEffect, useRef } from 'react';

export type FinanceSection = 'ledger' | 'budget' | 'analysis';

const sections: { id: FinanceSection; label: string; symbol: string }[] = [
  { id: 'ledger', label: 'Libro', symbol: '▤' },
  { id: 'budget', label: 'Presupuesto', symbol: '◷' },
  { id: 'analysis', label: 'Análisis', symbol: '▥' },
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
        <button className="sidebar-link future-link" disabled><span className="sidebar-symbol" aria-hidden="true">◌</span><span>Balance general<small>Próximamente</small></span></button>
        <button className="sidebar-link future-link" disabled><span className="sidebar-symbol" aria-hidden="true">◌</span><span>Flujo de caja<small>Próximamente</small></span></button>
      </nav>
      <button className="sidebar-close" onClick={close} aria-label="Cerrar menú">×</button>
    </aside>
  </>;
}
