import type { FastifyReply, FastifyRequest } from 'fastify';
import { ConflictError, NotFoundError } from '../../shared/errors.js';
import { diagnosticsJobForScope } from '../../modules/diagnostics/diagnostics.job.js';

export const diagnosticsController = {
  async run(request: FastifyRequest, reply: FastifyReply) {
    const job = diagnosticsJobForScope(request.demoSessionScope);
    const result = job.start();
    if (!result.started) throw new ConflictError('diagnostics already running');
    reply.status(202);
    return { runId: result.runId };
  },

  async status(request: FastifyRequest) {
    return diagnosticsJobForScope(request.demoSessionScope).status();
  },

  async report(request: FastifyRequest, reply: FastifyReply) {
    const job = diagnosticsJobForScope(request.demoSessionScope);
    if (job.isRunning()) throw new ConflictError('diagnostic report is still being generated');
    const report = job.result();
    if (!report) throw new NotFoundError('DiagnosticReport', 'latest');
    const date = report.generatedAt.slice(0, 10);
    reply.header('Cache-Control', 'no-store');
    reply.header('Content-Disposition', `attachment; filename="kr8bit-diagnostics-${date}.json"`);
    return reply.type('application/json; charset=utf-8').send(JSON.stringify(report, null, 2));
  },
};
