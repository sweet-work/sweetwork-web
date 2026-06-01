/* Cadence — Korean public holidays (우주항공청 월력요항 기반, @hyunbinseo/holidays-kr). */
import {
  y2018,
  y2019,
  y2020,
  y2021,
  y2022,
  y2023,
  y2024,
  y2025,
  y2026,
} from "@hyunbinseo/holidays-kr";

type YearMap = Readonly<Record<string, readonly string[]>>;

// 라이브러리가 지원하는 연도(2018~2026). 그 외 연도는 공휴일 표시 없음.
const YEARS: Record<number, YearMap> = {
  2018: y2018,
  2019: y2019,
  2020: y2020,
  2021: y2021,
  2022: y2022,
  2023: y2023,
  2024: y2024,
  2025: y2025,
  2026: y2026,
};

// 월력요항에는 포함되지만 관공서 공휴일(휴무일)이 아닌 날 — 빨간날 표시에서 제외.
const NON_OFF_DAYS = new Set(["제헌절", "노동절"]);

/* "YYYY-MM-DD"에 해당하는 공휴일 이름. 휴무일이 아니거나 미지원 연도면 null. */
export function holidayName(dateStr: string): string | null {
  const year = Number(dateStr.slice(0, 4));
  const map = YEARS[year];
  if (!map) return null;
  const names = map[dateStr];
  if (!names) return null;
  const offDay = names.find((n) => !NON_OFF_DAYS.has(n));
  return offDay ?? null;
}
