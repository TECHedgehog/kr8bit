import type { FastifyRequest, FastifyReply } from 'fastify';
import { scannerService } from '../../modules/scanner/scanner.service.js';
import { scannerRepository } from '../../modules/scanner/scanner.repository.js';
import { AppError } from '../../shared/errors.js';
import { onProgress } from '../../modules/scanner/scanner.events.js';
import type { ScanProgressEvent } from '../../modules/scanner/scanner.events.js';

export const scannerController = {
  async run(_req: FastifyRequest, reply: FastifyReply) {
    if (scannerService.isRunning()) {
      throw new AppError(409, 'scan already running', 'SCAN_RUNNING');
    }

    try {
      const run = await scannerService.start();
      reply.status(202);
      return run;
    } catch (err) {
      if ((err as Error).message === 'scan already running') {
        throw new AppError(409, 'scan already running', 'SCAN_RUNNING');
      }
      throw new AppError(500, `scan failed to start: ${(err as Error).message}`, 'SCAN_FAILED');
    }
  },

  async status(_req: FastifyRequest, _reply: FastifyReply) {
    const running = await scannerRepository.findRunning();
    const latest = await scannerRepository.findLatest();
    return {
      running: running,
      latest: latest,
      isRunning: scannerService.isRunning(),
      currentScanRunId: scannerService.currentScanRunId(),
    };
  },

  async progress(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(':ok\n\n');

    const unsubscribe = onProgress((event: ScanProgressEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.raw.on('close', () => {
      unsubscribe();
    });
  },
};