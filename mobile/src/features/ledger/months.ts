export function getCurrentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function moveMonth(month: string, offset: number) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(offset)) {
    throw new Error('El mes debe tener formato AAAA-MM.');
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getCalendarWeeks(month: string): (string | null)[][] {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new Error('El mes debe tener formato AAAA-MM.');
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const firstDayOffset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: (string | null)[] = Array(firstDayOffset).fill(null);

  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

export function formatMonth(month: string) {
  const label = new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
