import React from 'react';
import { Library } from 'lucide-react';

export default function Header({ onRefresh, loading }) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <div className="brand-icon">
            <Library size={24} />
          </div>
          <div>
            <span className="brand-title">Library Management System</span>
            <span className="brand-subtitle">Three-Tier Cloud Architecture (Netlify + Render + MongoDB Atlas)</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh book records from database"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>
    </header>
  );
}
