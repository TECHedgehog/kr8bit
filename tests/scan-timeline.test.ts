import { describe, expect, it } from 'vitest';
import { createScanTimeline } from '../src/modules/scanner/scan-timeline.js';
import type { ScanProgressEvent } from '../src/modules/scanner/scanner.events.js';

describe('scan timeline', () => {
  it('emits canonical stage events and tracks entry outcomes', async () => {
    const events: ScanProgressEvent[] = [];
    const timeline = createScanTimeline({
      scanRunId: 'run-1',
      emit: (event) => events.push(event),
    });

    timeline.started();
    timeline.candidatesFound(2);
    timeline.entryStarted('Game A');
    await timeline.entryMatched('added', 'Game A');
    timeline.entryStarted('Game B');
    await timeline.entryFailed('Game B', 'metadata unavailable');
    timeline.finished();

    expect(events.map(({ phase, stage }) => [phase, stage])).toEqual([
      ['start', 'scan'],
      ['start', 'metadata'],
      ['start', 'artwork'],
      ['candidate', 'scan'],
      ['candidate', 'metadata'],
      ['matched', 'metadata'],
      ['matched', 'artwork'],
      ['matched', 'scan'],
      ['candidate', 'metadata'],
      ['failed', 'metadata'],
      ['matched', 'artwork'],
      ['matched', 'scan'],
      ['done', 'done'],
    ]);
    expect(events[5]).toMatchObject({ completed: 1, found: 2, added: 1, updated: 0, failed: 0 });
    expect(events[1]).toMatchObject({ found: 0, total: 2, completed: 0 });
    expect(events[3]).toMatchObject({ found: 2, total: 2, completed: 0 });
    expect(events[9]).toMatchObject({ currentEntry: 'Game B', message: 'metadata unavailable', failed: 1 });
    expect(events.at(-1)).toMatchObject({ completed: 2, found: 2, added: 1, updated: 0, failed: 1 });
  });

  it('records directory-walk failure for the terminal event', () => {
    const events: ScanProgressEvent[] = [];
    const timeline = createScanTimeline({
      scanRunId: 'run-2',
      emit: (event) => events.push(event),
    });

    timeline.started();
    timeline.walkFailed();
    expect(timeline.counts()).toEqual({ found: 0, added: 0, updated: 0, failed: 1 });
    timeline.finished('directory unavailable');

    expect(events.at(-1)).toMatchObject({
      phase: 'done',
      stage: 'done',
      message: 'directory unavailable',
      found: 0,
      added: 0,
      updated: 0,
      failed: 1,
    });
  });

  it('counts updated and skipped entries independently', async () => {
    const events: ScanProgressEvent[] = [];
    const timeline = createScanTimeline({
      scanRunId: 'run-3',
      emit: (event) => events.push(event),
    });

    timeline.started();
    timeline.candidatesFound(2);
    timeline.entryStarted('Game A');
    await timeline.entryMatched('updated', 'Game A');
    timeline.entryStarted('Game B');
    await timeline.entryMatched('skipped', 'Game B');
    timeline.finished();

    expect(events.at(-1)).toMatchObject({ found: 2, completed: 2, added: 0, updated: 1, failed: 0 });
  });
});
