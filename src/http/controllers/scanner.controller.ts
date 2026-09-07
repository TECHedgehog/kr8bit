import type { FastifyRequest, FastifyReply } from 'fastify';
import { scannerService } from '../../modules/scanner/scanner.service.js';
import { AppError } from '../../shared/errors.js';
import { onProgress } from '../../modules/scanner/scanner.events.js';
import type { ScanProgressEvent } from '../../modules/scanner/scanner.events.js';

const SSE_HEARTBEAT_MS = 15_000;

export const scannerController = {
  async run(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const run = await scannerService.start();
      reply.status(202);
      return run;
    } catch (err) {
      // scannerService throws typed AppErrors (409 SCAN_RUNNING /
      // RESET_RUNNING); only wrap unexpected failures as 500.
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(500, `scan failed to start: ${(err as Error).message}`, 'SCAN_FAILED');
    }
  },

  async status(_req: FastifyRequest, _reply: FastifyReply) {
    return scannerService.status();
  },

  async progress(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Take over the raw socket from Fastify: after the handler resolves,
    // Fastify would retry writeHead on the already-written response and
    // emit ERR_HTTP_HEADERS_SENT.
    reply.hijack();
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

    // Comment heartbeat: keeps proxies and browsers from closing the
    // connection during long walks that emit no progress events.
    const heartbeat = setInterval(() => {
      reply.raw.write(':ping\n\n');
    }, SSE_HEARTBEAT_MS);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  },
};