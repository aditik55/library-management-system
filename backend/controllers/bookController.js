const Book = require('../models/Book');

const REQUIRED_FIELDS = ['bookId', 'title', 'author', 'category', 'totalCopies', 'availableCopies'];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const findBookQuery = (id) => {
  if (!id || typeof id !== 'string') {
    return { bookId: '' };
  }
  if (/^[0-9a-fA-F]{24}$/.test(id)) {
    return { $or: [{ _id: id }, { bookId: id.toUpperCase() }] };
  }
  return { bookId: id.toUpperCase() };
};

const parseCopies = (value, label, min) => {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    return { error: `${label} must be a whole number` };
  }
  if (number < min) {
    return { error: min === 0 ? `${label} cannot be negative` : `${label} must be at least 1` };
  }
  return { value: number };
};

const parseYear = (value) => {
  if (isBlank(value)) {
    return { value: undefined };
  }
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1000 || year > 2100) {
    return { error: 'Publication year must be a whole number from 1000 to 2100' };
  }
  return { value: year };
};

const sendModelError = (res, error, fallback) => {
  if (error && error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'A book with this bookId already exists.'
    });
  }

  if (error && error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', ')
    });
  }

  if (error && error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid value for ${error.path || 'field'}`
    });
  }

  return res.status(500).json({
    success: false,
    message: fallback,
    error: error.message
  });
};

const summarizeBooks = (books) => {
  const totalBooks = books.length;
  const totalCopies = books.reduce((sum, book) => sum + Number(book.totalCopies || 0), 0);
  const availableCopies = books.reduce((sum, book) => sum + Number(book.availableCopies || 0), 0);

  return {
    totalBooks,
    totalCopies,
    availableCopies,
    unavailableCopies: totalCopies - availableCopies
  };
};

exports.getAllBooks = async (req, res) => {
  try {
    const { search, category } = req.query;
    const query = {};

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { bookId: regex },
        { title: regex },
        { author: regex },
        { isbn: regex }
      ];
    }

    if (category && category.trim()) {
      query.category = category.trim();
    }

    const books = await Book.find(query).sort({ title: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: books.length,
      data: books
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve books',
      error: error.message
    });
  }
};

exports.getBookById = async (req, res) => {
  try {
    const book = await Book.findOne(findBookQuery(req.params.id));

    if (!book) {
      return res.status(404).json({
        success: false,
        message: `Book with ID '${req.params.id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      data: book
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching book record',
      error: error.message
    });
  }
};

exports.createBook = async (req, res) => {
  try {
    const missing = REQUIRED_FIELDS.filter((field) => isBlank(req.body[field]) && req.body[field] !== 0);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Required fields missing: ${missing.join(', ')}`
      });
    }

    const total = parseCopies(req.body.totalCopies, 'Total copies', 1);
    const available = parseCopies(req.body.availableCopies, 'Available copies', 0);
    const year = parseYear(req.body.publicationYear);
    const problems = [total.error, available.error, year.error].filter(Boolean);

    if (problems.length > 0) {
      return res.status(400).json({
        success: false,
        message: problems.join(', ')
      });
    }

    if (available.value > total.value) {
      return res.status(400).json({
        success: false,
        message: 'Available copies cannot exceed total copies'
      });
    }

    const category = String(req.body.category).trim();
    if (!Book.CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${Book.CATEGORIES.join(', ')}`
      });
    }

    const isbn = isBlank(req.body.isbn) ? '' : String(req.body.isbn).trim();
    if (isbn.length > 32) {
      return res.status(400).json({
        success: false,
        message: 'ISBN must be 32 characters or fewer'
      });
    }

    const bookId = String(req.body.bookId).trim().toUpperCase();
    const existingBook = await Book.findOne({ bookId });
    if (existingBook) {
      return res.status(400).json({
        success: false,
        message: `Book with Book ID '${req.body.bookId}' already exists.`
      });
    }

    const payload = {
      bookId,
      title: String(req.body.title).trim(),
      author: String(req.body.author).trim(),
      isbn,
      category,
      publisher: isBlank(req.body.publisher) ? '' : String(req.body.publisher).trim(),
      totalCopies: total.value,
      availableCopies: available.value
    };

    if (year.value !== undefined) {
      payload.publicationYear = year.value;
    }

    const book = await Book.create(payload);

    res.status(201).json({
      success: true,
      message: 'Book added successfully.',
      data: book
    });
  } catch (error) {
    sendModelError(res, error, 'Failed to create book');
  }
};

exports.updateBook = async (req, res) => {
  try {
    const book = await Book.findOne(findBookQuery(req.params.id));

    if (!book) {
      return res.status(404).json({
        success: false,
        message: `Book with ID '${req.params.id}' not found`
      });
    }

    const {
      bookId,
      title,
      author,
      isbn,
      category,
      publisher,
      publicationYear,
      totalCopies,
      availableCopies
    } = req.body;

    if (bookId !== undefined && String(bookId).trim().toUpperCase() !== book.bookId) {
      const nextId = String(bookId).trim().toUpperCase();
      if (!nextId) {
        return res.status(400).json({
          success: false,
          message: 'Book ID is required'
        });
      }
      const duplicate = await Book.findOne({ bookId: nextId });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Book ID '${bookId}' is already assigned to another book.`
        });
      }
      book.bookId = nextId;
    }

    if (title !== undefined) {
      if (isBlank(title)) {
        return res.status(400).json({ success: false, message: 'Book title is required' });
      }
      book.title = String(title).trim();
    }

    if (author !== undefined) {
      if (isBlank(author)) {
        return res.status(400).json({ success: false, message: 'Author is required' });
      }
      book.author = String(author).trim();
    }

    if (isbn !== undefined) {
      const nextIsbn = isBlank(isbn) ? '' : String(isbn).trim();
      if (nextIsbn.length > 32) {
        return res.status(400).json({
          success: false,
          message: 'ISBN must be 32 characters or fewer'
        });
      }
      book.isbn = nextIsbn;
    }

    if (category !== undefined) {
      const nextCategory = String(category).trim();
      if (!Book.CATEGORIES.includes(nextCategory)) {
        return res.status(400).json({
          success: false,
          message: `Category must be one of: ${Book.CATEGORIES.join(', ')}`
        });
      }
      book.category = nextCategory;
    }

    if (publisher !== undefined) {
      book.publisher = isBlank(publisher) ? '' : String(publisher).trim();
    }

    if (publicationYear !== undefined) {
      const year = parseYear(publicationYear);
      if (year.error) {
        return res.status(400).json({ success: false, message: year.error });
      }
      book.publicationYear = year.value === undefined ? null : year.value;
    }

    let nextTotal = book.totalCopies;
    let nextAvailable = book.availableCopies;

    if (totalCopies !== undefined) {
      const parsed = parseCopies(totalCopies, 'Total copies', 1);
      if (parsed.error) {
        return res.status(400).json({ success: false, message: parsed.error });
      }
      nextTotal = parsed.value;
    }

    if (availableCopies !== undefined) {
      const parsed = parseCopies(availableCopies, 'Available copies', 0);
      if (parsed.error) {
        return res.status(400).json({ success: false, message: parsed.error });
      }
      nextAvailable = parsed.value;
    }

    if (nextAvailable > nextTotal) {
      return res.status(400).json({
        success: false,
        message: 'Available copies cannot exceed total copies'
      });
    }

    book.totalCopies = nextTotal;
    book.availableCopies = nextAvailable;

    const updatedBook = await book.save();

    res.status(200).json({
      success: true,
      message: 'Book updated successfully.',
      data: updatedBook
    });
  } catch (error) {
    sendModelError(res, error, 'Failed to update book');
  }
};

exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findOneAndDelete(findBookQuery(req.params.id));

    if (!book) {
      return res.status(404).json({
        success: false,
        message: `Book with ID '${req.params.id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      message: `Book '${book.bookId}' (${book.title}) deleted successfully.`,
      data: { bookId: book.bookId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete book',
      error: error.message
    });
  }
};

exports.getBookStats = async (req, res) => {
  try {
    const books = await Book.find();
    res.status(200).json({
      success: true,
      data: summarizeBooks(books)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get stats',
      error: error.message
    });
  }
};
