import { EventEmitter } from 'node:events';

export interface ScanProgressEvent {
  scanRunId: string;
  phase: 'start' | 'candidate' | 'matched' | 'failed' | 'done';
  found: number;
  added: number;
  updated: number;
  failed: number;
  currentEntry?: string;
  message?: string;
}

export const scannerEvents = new EventEmitter();
scannerEvents.setMaxListeners(50);

export function emitProgress(event: ScanProgressEvent): void {
  scannerEvents.emit('progress', event);
}

export function onProgress(listener: (event: ScanProgressEvent) => void): () => void {
  scannerEvents.on('progress', listener);
  return () => scannerEvents.off('progress', listener);
}