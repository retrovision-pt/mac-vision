import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const html = readFileSync('public/mac-vision/original.html', 'utf8');
const start = html.indexOf('function macRestoreImportedScheduleRows(');
const end = html.indexOf('function isScheduleHeadingName(', start);
const restore = runInNewContext(`${html.slice(start, end)}; macRestoreImportedScheduleRows`, {
  norm: (name: string) => name.toUpperCase().replace(/\s/g, ''),
});

describe('Schedule reimport restores only imported rows', () => {
  it('removes stale exclusions for imported employees in their month', () => {
    const data = { macScheduleExcludedByMonth: { '2026-11': ['ANA', 'BRUNO'], '2026-12': ['ANA'] } };
    restore(data, [{ employee: 'Ana', date: '2026-11-14' }]);
    expect(data.macScheduleExcludedByMonth['2026-11']).toEqual(['BRUNO']);
    expect(data.macScheduleExcludedByMonth['2026-12']).toEqual(['ANA']);
  });
  it('does not create exclusions or change rows when none exist', () => {
    const data = { schedules: [{ employee: 'Ana', date: '2026-11-14', code: 'A' }] };
    restore(data, data.schedules);
    expect(data).toEqual({ schedules: [{ employee: 'Ana', date: '2026-11-14', code: 'A' }] });
  });
});