import { fromZonedTime } from 'date-fns-tz';

export interface ReportDateRange {
  from: Date;
  to: Date;
}

export function calculateReportDateRange(reportDate: string, timezone: string): ReportDateRange {
  const from = fromZonedTime(`${reportDate}T00:00:00.000`, timezone);
  const nextDay = new Date(`${reportDate}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextDate = nextDay.toISOString().slice(0, 10);
  const to = fromZonedTime(`${nextDate}T00:00:00.000`, timezone);
  return { from, to };
}
