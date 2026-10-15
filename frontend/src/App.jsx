import React, { useState, useEffect, useCallback } from 'react';
import { Search, BookPlus } from 'lucide-react';
import Header from './components/Header';
import ArchitectureBanner from './components/ArchitectureBanner';
import BookStats from './components/BookStats';
import BookTable from './components/BookTable';
import BookModal from './components/BookModal';
import DeleteModal from './components/DeleteModal';
import Toast from './components/Toast';
import { bookAPI } from './services/api';
import { CATEGORIES } from './categories';

const EMPTY_STATS = {
  totalBooks: 0,
  totalCopies: 0,
  availableCopies: 0,
  unavailableCopies: 0
};

export default function App() {
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookToEdit, setBookToEdit] = useState(null);
  const [bookToDelete, setBookToDelete] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [backendHealthy, setBackendHealthy] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(true);

  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const health = await bookAPI.checkHealth();
      setBackendHealthy(health?.database === 'connected');
    } catch (err) {
      setBackendHealthy(false);
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await bookAPI.getStats();
      if (res && res.data) {
        setStats({
          totalBooks: res.data.totalBooks ?? 0,
          totalCopies: res.data.totalCopies ?? 0,
          availableCopies: res.data.availableCopies ?? 0,
          unavailableCopies: res.data.unavailableCopies ?? 0
        });
      }
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, []);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bookAPI.getAll({
        search: searchTerm,
        category: selectedCategory
      });
      if (res && res.data) {
        setBooks(res.data);
        setBackendHealthy(true);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setBackendHealthy(false);
      addToast(err.message || 'Failed to fetch books from backend', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    checkHealth();
    fetchStats();
  }, [checkHealth, fetchStats]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchBooks();
    }, 250);
    return () => clearTimeout(timeout);
  }, [fetchBooks]);

  const handleSaveBook = async (bookData, isEditing) => {
    if (isEditing) {
      await bookAPI.update(bookData.bookId, bookData);
      addToast(`Book '${bookData.bookId}' updated successfully!`, 'success');
    } else {
      await bookAPI.create(bookData);
      addToast(`Book '${bookData.bookId}' added successfully!`, 'success');
    }
    await Promise.all([fetchBooks(), fetchStats()]);
  };

  const handleEditClick = (book) => {
    setBookToEdit(book);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (book) => {
    setBookToDelete(book);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async (bookId) => {
    try {
      await bookAPI.delete(bookId);
      addToast(`Book '${bookId}' deleted successfully.`, 'success');
      await Promise.all([fetchBooks(), fetchStats()]);
    } catch (err) {
      addToast(err.message || 'Failed to delete book', 'error');
      throw err;
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchBooks(), fetchStats(), checkHealth()]);
  };

  return (
    <div className="app-container">
      <Header onRefresh={handleRefresh} loading={loading} />

      <main className="main-content">
        <ArchitectureBanner
          backendHealthy={backendHealthy}
          checkingHealth={checkingHealth}
        />

        <BookStats stats={stats} />

        <div className="action-bar">
          <div className="search-group">
            <div className="search-input-wrapper">
              <Search size={18} />
              <input
                type="text"
                className="search-input"
                placeholder="Search by book ID, title, author, or ISBN"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setBookToEdit(null);
              setIsModalOpen(true);
            }}
          >
            <BookPlus size={18} /> Add Book
          </button>
        </div>

        <BookTable
          books={books}
          loading={loading}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      </main>

      <BookModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setBookToEdit(null);
        }}
        onSave={handleSaveBook}
        bookToEdit={bookToEdit}
      />

      <DeleteModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setBookToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        book={bookToDelete}
      />

      <Toast toasts={toasts} onDismiss={removeToast} />

      <footer className="app-footer">
        <p>
          Library Management System &bull; Three-Tier Cloud Architecture
        </p>
        <div className="footer-tags">
          <span className="footer-tag">Netlify (Presentation)</span>
          <span className="footer-tag">Render (Application / API)</span>
          <span className="footer-tag">MongoDB Atlas (Database)</span>
        </div>
      </footer>
    </div>
  );
}
