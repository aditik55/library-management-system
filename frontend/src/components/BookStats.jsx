import React from 'react';
import { BookOpen, Layers, CheckCircle2, BookX } from 'lucide-react';

export default function BookStats({ stats }) {
  const totalBooks = stats?.totalBooks ?? 0;
  const totalCopies = stats?.totalCopies ?? 0;
  const availableCopies = stats?.availableCopies ?? 0;
  const unavailableCopies = stats?.unavailableCopies ?? 0;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div>
          <div className="stat-value">{totalBooks}</div>
          <div className="stat-label">Total Titles</div>
        </div>
        <div className="stat-icon">
          <BookOpen size={24} />
        </div>
      </div>

      <div className="stat-card">
        <div>
          <div className="stat-value">{totalCopies}</div>
          <div className="stat-label">Total Copies</div>
        </div>
        <div className="stat-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>
          <Layers size={24} />
        </div>
      </div>

      <div className="stat-card">
        <div>
          <div className="stat-value">{availableCopies}</div>
          <div className="stat-label">Available Copies</div>
        </div>
        <div className="stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
          <CheckCircle2 size={24} />
        </div>
      </div>

      <div className="stat-card">
        <div>
          <div className="stat-value">{unavailableCopies}</div>
          <div className="stat-label">Unavailable Copies</div>
        </div>
        <div className="stat-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
          <BookX size={24} />
        </div>
      </div>
    </div>
  );
}
