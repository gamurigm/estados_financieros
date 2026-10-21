import { IonIcon } from '@ionic/react';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';

const formatMonth = (month: string) => new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));

export function MonthNavigator({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const move = (offset: number) => {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  return <div className="month-picker">
    <button aria-label="Mes anterior" onClick={() => move(-1)}><IonIcon icon={chevronBackOutline} /></button>
    <label htmlFor="section-month-input">{formatMonth(month)}</label>
    <input id="section-month-input" type="month" value={month} onChange={(event) => { if (event.target.value) onChange(event.target.value); }} aria-label="Elegir mes" />
    <button aria-label="Mes siguiente" onClick={() => move(1)}><IonIcon icon={chevronForwardOutline} /></button>
  </div>;
}
