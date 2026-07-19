import type { MatchStatus } from '../api/types';

const STATUS_CLASS: Record<MatchStatus, string> = {
  PENDING: 'status-pending',
  FLAGGED: 'status-flagged',
  ACCEPTED: 'status-accepted',
  MANUAL: 'status-manual',
  REJECTED: 'status-rejected',
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`status-badge ${STATUS_CLASS[status]}`}>{status}</span>
  );
}