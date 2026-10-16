import { EventEmitter } from 'node:events';
import type { ScanProgressEvent } from './scan-timeline.js';

export type { ScanProgressEvent } from './scan-timeline.js';

export const scannerEvents = new EventEmitter();
// One listener per SSE client; client count is unbounded by design.
// 0 disables the MaxListenersExceeded warning.
scannerEvents.setMaxListeners(0);

export function emitProgress(event: ScanProgressEvent): void {
  scannerEvents.emit('progress', event);
}

export function onProgress(listener: (event: ScanProgressEvent) => void): () => void {
  scannerEvents.on('progress', listener);
  return () => scannerEvents.off('progress', listener);
}
