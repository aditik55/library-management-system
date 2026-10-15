import React from 'react';
import { Edit2, Trash2, BookX, User } from 'lucide-react';

export default function BookTable({ books, loading, onEdit, onDelete }) {
  if (loading) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>Loading book records...</div>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Fetching data from Render API &amp; MongoDB Atlas
          </p>
        </div>
      </div>
    );
  }

  if (!books || books.length === 0) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <div className="empty-state-icon">
            <BookX size={48} />
          </div>
          <h3>No Books Found</h3>
          <p>Click "Add Book" to create your first record, or clear your search filter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div style={{ overflowX: 'auto' }}>
        <table className="book-table">
          <thead>
            <tr>
              <th>Book ID</th>
              <th>Title</th>
              <th>Author</th>
              <th>Category</th>
              <th>ISBN</th>
              <th>Total Copies</th>
              <th>Available Copies</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book._id || book.bookId}>
                <td>
                  <span className="book-id-badge">{book.bookId}</span>
                </td>
                <td style={{ fontWeight: 600, color: '#0f172a' }}>{book.title}</td>
                <td style={{ color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <User size={14} color="#94a3b8" />
                    <span>{book.author}</span>
                  </div>
                </td>
                <td>{book.category}</td>
                <td style={{ color: '#475569' }}>{book.isbn || '—'}</td>
                <td>{book.totalCopies}</td>
                <td>
                  <span className={book.availableCopies === 0 ? 'status-badge status-cancelled' : 'status-badge status-ongoing'}>
                    {book.availableCopies}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn-icon edit"
                      onClick={() => onEdit(book)}
                      title="Edit Book Details"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="btn-icon delete"
                      onClick={() => onDelete(book)}
                      title="Delete Book Record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
