import { Link } from 'react-router-dom';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="page">
      <div className="notfound">
        <div className="notfound-title">404</div>
        <div className="notfound-text">Page not found</div>
        <Link to="/games" className="topbar-link" style={{ marginTop: '16px' }}>
          Back to Library
        </Link>
      </div>
    </div>
  );
}