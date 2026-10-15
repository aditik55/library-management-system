import React, { useState, useEffect } from 'react';
import { X, Save, BookPlus } from 'lucide-react';
import { CATEGORIES } from '../categories';

const EMPTY_BOOK = {
  bookId: '',
  title: '',
  author: '',
  isbn: '',
  category: 'Computer Science',
  publisher: '',
  publicationYear: '',
  totalCopies: 1,
  availableCopies: 1
};

export default function BookModal({ isOpen, onClose, onSave, bookToEdit }) {
  const isEditing = Boolean(bookToEdit);

  const [formData, setFormData] = useState(EMPTY_BOOK);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (bookToEdit) {
      setFormData({
        bookId: bookToEdit.bookId || '',
        title: bookToEdit.title || '',
        author: bookToEdit.author || '',
        isbn: bookToEdit.isbn || '',
        category: bookToEdit.category || 'Computer Science',
        publisher: bookToEdit.publisher || '',
        publicationYear: bookToEdit.publicationYear ?? '',
        totalCopies: bookToEdit.totalCopies ?? 1,
        availableCopies: bookToEdit.availableCopies ?? 1
      });
    } else {
      setFormData(EMPTY_BOOK);
    }
    setError('');
  }, [bookToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'totalCopies' || name === 'availableCopies' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.bookId.trim()) {
      setError('Book ID is required (e.g. BK101).');
      return;
    }
    if (!formData.title.trim()) {
      setError('Book title is required.');
      return;
    }
    if (!formData.author.trim()) {
      setError('Author is required.');
      return;
    }
    if (!Number.isInteger(Number(formData.totalCopies)) || Number(formData.totalCopies) < 1) {
      setError('Total copies must be a whole number of at least 1.');
      return;
    }
    if (!Number.isInteger(Number(formData.availableCopies)) || Number(formData.availableCopies) < 0) {
      setError('Available copies must be a whole number of 0 or more.');
      return;
    }
    if (Number(formData.availableCopies) > Number(formData.totalCopies)) {
      setError('Available copies cannot exceed total copies.');
      return;
    }
    if (String(formData.publicationYear).trim() !== '') {
      const year = Number(formData.publicationYear);
      if (!Number.isInteger(year) || year < 1000 || year > 2100) {
        setError('Publication year must be a whole number from 1000 to 2100.');
        return;
      }
    }

    try {
      setSubmitting(true);
      await onSave(formData, isEditing);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save book details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {isEditing ? `Edit Book: ${formData.bookId}` : 'Add New Book'}
          </h3>
          <button className="modal-close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}
              >
                {error}
              </div>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  Book ID <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="bookId"
                  className="form-control"
                  placeholder="e.g. BK101"
                  value={formData.bookId}
                  onChange={handleChange}
                  disabled={isEditing}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Publication Year</label>
                <input
                  type="number"
                  name="publicationYear"
                  className="form-control"
                  min="1000"
                  max="2100"
                  placeholder="e.g. 2008"
                  value={formData.publicationYear}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">
                  Title <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  className="form-control"
                  placeholder="e.g. Clean Code"
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Author <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="author"
                  className="form-control"
                  placeholder="e.g. Robert C. Martin"
                  value={formData.author}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">ISBN</label>
                <input
                  type="text"
                  name="isbn"
                  className="form-control"
                  placeholder="e.g. 9780132350884"
                  value={formData.isbn}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Category <span className="required">*</span>
                </label>
                <select
                  name="category"
                  className="form-control"
                  value={formData.category}
                  onChange={handleChange}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Publisher</label>
                <input
                  type="text"
                  name="publisher"
                  className="form-control"
                  placeholder="e.g. Prentice Hall"
                  value={formData.publisher}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Total Copies <span className="required">*</span>
                </label>
                <input
                  type="number"
                  name="totalCopies"
                  className="form-control"
                  min="1"
                  step="1"
                  placeholder="e.g. 5"
                  value={formData.totalCopies}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Available Copies <span className="required">*</span>
                </label>
                <input
                  type="number"
                  name="availableCopies"
                  className="form-control"
                  min="0"
                  step="1"
                  placeholder="e.g. 3"
                  value={formData.availableCopies}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                'Saving...'
              ) : isEditing ? (
                <>
                  <Save size={16} /> Update Book
                </>
              ) : (
                <>
                  <BookPlus size={16} /> Add Book
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
