process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it, before, after, beforeEach } = require('node:test');
const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

const Book = require('../models/Book');
const app = require('../server');

const store = [];
let server;
let baseUrl;

function valueMatches(actual, expected) {
  if (expected instanceof RegExp) {
    return expected.test(String(actual ?? ''));
  }
  return String(actual ?? '') === String(expected);
}

function matches(book, query) {
  if (!query || Object.keys(query).length === 0) return true;

  if (Object.prototype.hasOwnProperty.call(query, 'category') && book.category !== query.category) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(query, 'bookId') && !(query.bookId instanceof RegExp)) {
    if (!valueMatches(book.bookId, query.bookId)) return false;
  }

  if (query.$or) {
    const orMatch = query.$or.some((clause) =>
      Object.entries(clause).every(([field, expected]) => valueMatches(book[field], expected))
    );
    if (!orMatch) return false;
  }

  return true;
}

function asQuery(rows) {
  const items = rows.map((row) => ({ ...row }));
  const query = {
    sort() {
      items.sort((a, b) => String(a.title).localeCompare(String(b.title)));
      return query;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(items).then(onFulfilled, onRejected);
    }
  };
  return query;
}

function duplicateError() {
  const error = new Error('E11000 duplicate key error');
  error.code = 11000;
  error.keyPattern = { bookId: 1 };
  return error;
}

function hydrate(record) {
  const doc = Book.hydrate(record);
  doc.save = async function save() {
    await this.validate();
    const duplicate = store.find(
      (item) => item.bookId === this.bookId && String(item._id) !== String(this._id)
    );
    if (duplicate) throw duplicateError();

    const index = store.findIndex((item) => String(item._id) === String(this._id));
    if (index === -1) throw new Error('Book not found during save');

    const saved = this.toObject();
    saved._id = String(this._id);
    store[index] = saved;
    return this;
  };
  return doc;
}

function installMemoryModel() {
  Book.find = (query = {}) => asQuery(store.filter((item) => matches(item, query)));

  Book.findOne = async (query = {}) => {
    const found = store.find((item) => matches(item, query));
    return found ? hydrate(found) : null;
  };

  Book.findOneAndDelete = async (query = {}) => {
    const index = store.findIndex((item) => matches(item, query));
    if (index === -1) return null;
    const [removed] = store.splice(index, 1);
    return removed;
  };

  Book.create = async (payload) => {
    const doc = new Book(payload);
    await doc.validate();
    if (store.some((item) => item.bookId === doc.bookId)) {
      throw duplicateError();
    }
    const saved = doc.toObject();
    saved._id = new mongoose.Types.ObjectId().toString();
    saved.createdAt = new Date();
    saved.updatedAt = new Date();
    store.push(saved);
    return saved;
  };
}

function sampleBook(overrides = {}) {
  return {
    bookId: 'BK101',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    category: 'Computer Science',
    publisher: 'Prentice Hall',
    publicationYear: 2008,
    totalCopies: 5,
    availableCopies: 3,
    ...overrides
  };
}

async function api(method, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function seed(overrides) {
  const response = await api('POST', '/api/books', sampleBook(overrides));
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.data.data;
}

function readCategories(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/const CATEGORIES = \[([\s\S]*?)\];/);
  assert.ok(match, `CATEGORIES array not found in ${filePath}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

describe('Book schema', () => {
  it('accepts a valid book and normalizes the book id', async () => {
    const doc = new Book(sampleBook({ bookId: ' bk101 ' }));
    await doc.validate();
    assert.equal(doc.bookId, 'BK101');
  });

  it('rejects copy counts that are impossible', async () => {
    const tooMany = new Book(sampleBook({ totalCopies: 2, availableCopies: 5 }));
    await assert.rejects(() => tooMany.validate(), (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.match(error.message, /Available copies cannot exceed total copies/);
      return true;
    });

    const zeroTotal = new Book(sampleBook({ totalCopies: 0, availableCopies: 0 }));
    await assert.rejects(() => zeroTotal.validate(), (error) => {
      assert.match(error.message, /Total copies must be at least 1/);
      return true;
    });

    const negative = new Book(sampleBook({ availableCopies: -1 }));
    await assert.rejects(() => negative.validate(), (error) => {
      assert.match(error.message, /Available copies cannot be negative/);
      return true;
    });

    const fraction = new Book(sampleBook({ totalCopies: 1.5 }));
    await assert.rejects(() => fraction.validate(), (error) => {
      assert.match(error.message, /Total copies must be a whole number/);
      return true;
    });
  });

  it('rejects a bad category, a missing title, and a bad publication year', async () => {
    const badCategory = new Book(sampleBook({ category: 'Workshop' }));
    await assert.rejects(() => badCategory.validate(), (error) => {
      assert.match(error.message, /Category must be/);
      return true;
    });

    const missingTitle = new Book(sampleBook({ title: '   ' }));
    await assert.rejects(() => missingTitle.validate(), (error) => {
      assert.match(error.message, /Book title is required/);
      return true;
    });

    const badYear = new Book(sampleBook({ publicationYear: 999 }));
    await assert.rejects(() => badYear.validate(), (error) => {
      assert.match(error.message, /Publication year/);
      return true;
    });
  });

  it('allows ISBN and publication year to be omitted', async () => {
    const doc = new Book(sampleBook({ isbn: undefined, publicationYear: undefined }));
    await doc.validate();
    assert.equal(doc.isbn, '');
    assert.equal(doc.publicationYear, undefined);
  });
});

describe('Library API', () => {
  before(async () => {
    installMemoryModel();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (!server) return;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    store.length = 0;
  });

  it('reports process health without pretending the database is connected', async () => {
    const root = await api('GET', '/');
    assert.equal(root.status, 200);
    assert.match(root.data.message, /Library Management System API is running/);

    const health = await api('GET', '/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.database, 'disconnected');
    assert.equal(health.data.status, 'DEGRADED');
  });

  it('does not expose the old records API', async () => {
    const response = await api('GET', '/api/events');
    assert.equal(response.status, 404);
  });

  it('creates, reads, updates, and deletes a book', async () => {
    const created = await seed({ bookId: 'bk101' });
    assert.equal(created.bookId, 'BK101');
    assert.equal(created.title, 'Clean Code');
    assert.equal(created.publicationYear, 2008);

    const byCode = await api('GET', '/api/books/bk101');
    assert.equal(byCode.status, 200);
    assert.equal(byCode.data.data.author, 'Robert C. Martin');

    const byMongoId = await api('GET', `/api/books/${created._id}`);
    assert.equal(byMongoId.status, 200);
    assert.equal(byMongoId.data.data.bookId, 'BK101');

    const updated = await api('PUT', '/api/books/BK101', {
      title: 'Clean Code, 2nd Edition',
      availableCopies: 1
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.data.title, 'Clean Code, 2nd Edition');
    assert.equal(updated.data.data.availableCopies, 1);
    assert.equal(updated.data.data.totalCopies, 5);

    const removed = await api('DELETE', '/api/books/BK101');
    assert.equal(removed.status, 200);
    assert.match(removed.data.message, /deleted successfully/);

    const missing = await api('GET', '/api/books/BK101');
    assert.equal(missing.status, 404);
  });

  it('rejects duplicate book ids, including a different letter case', async () => {
    await seed();
    const duplicate = await api('POST', '/api/books', sampleBook({ bookId: 'bk101', title: 'Another Title' }));
    assert.equal(duplicate.status, 400);
    assert.match(duplicate.data.message, /already exists/i);

    const listed = await api('GET', '/api/books');
    assert.equal(listed.data.count, 1);
  });

  it('returns 400 when the database reports a duplicate book id', async () => {
    const originalFindOne = Book.findOne;
    const originalCreate = Book.create;
    Book.findOne = async () => null;
    Book.create = async () => {
      throw duplicateError();
    };

    try {
      const response = await api('POST', '/api/books', sampleBook());
      assert.equal(response.status, 400);
      assert.match(response.data.message, /already exists/i);
    } finally {
      Book.findOne = originalFindOne;
      Book.create = originalCreate;
    }
  });

  it('rejects invalid books', async () => {
    const missing = await api('POST', '/api/books', sampleBook({ author: '  ' }));
    assert.equal(missing.status, 400);
    assert.match(missing.data.message, /author/i);

    const tooMany = await api('POST', '/api/books', sampleBook({ bookId: 'BK102', totalCopies: 2, availableCopies: 9 }));
    assert.equal(tooMany.status, 400);
    assert.match(tooMany.data.message, /cannot exceed total copies/i);

    const zero = await api('POST', '/api/books', sampleBook({ bookId: 'BK103', totalCopies: 0, availableCopies: 0 }));
    assert.equal(zero.status, 400);
    assert.match(zero.data.message, /at least 1/);

    const negative = await api('POST', '/api/books', sampleBook({ bookId: 'BK104', availableCopies: -1 }));
    assert.equal(negative.status, 400);
    assert.match(negative.data.message, /cannot be negative/i);

    const fraction = await api('POST', '/api/books', sampleBook({ bookId: 'BK105', totalCopies: 1.5 }));
    assert.equal(fraction.status, 400);
    assert.match(fraction.data.message, /whole number/i);

    const category = await api('POST', '/api/books', sampleBook({ bookId: 'BK106', category: 'Workshop' }));
    assert.equal(category.status, 400);
    assert.match(category.data.message, /Category must be/);

    const year = await api('POST', '/api/books', sampleBook({ bookId: 'BK107', publicationYear: 999 }));
    assert.equal(year.status, 400);
    assert.match(year.data.message, /Publication year/);

    const listed = await api('GET', '/api/books');
    assert.equal(listed.data.count, 0);
  });

  it('searches by title, author, book id, and ISBN, then filters by category', async () => {
    await seed();
    await seed({
      bookId: 'BK102',
      title: 'The Pragmatic Programmer',
      author: 'Andy Hunt',
      isbn: '9780201616224',
      category: 'Computer Science',
      totalCopies: 2,
      availableCopies: 0
    });
    await seed({
      bookId: 'BK103',
      title: 'A Brief History of Time',
      author: 'Stephen Hawking',
      isbn: '9780553380163',
      category: 'Science',
      publisher: 'Bantam',
      totalCopies: 4,
      availableCopies: 4
    });
    await seed({
      bookId: 'BK104',
      title: 'C++ Primer',
      author: 'Stanley Lippman',
      isbn: '9780321714114',
      category: 'Computer Science',
      totalCopies: 1,
      availableCopies: 1
    });

    const byAuthor = await api('GET', '/api/books?search=hawking');
    assert.deepEqual(byAuthor.data.data.map((book) => book.bookId), ['BK103']);

    const byIsbn = await api('GET', '/api/books?search=9780132350884');
    assert.deepEqual(byIsbn.data.data.map((book) => book.bookId), ['BK101']);

    const byId = await api('GET', '/api/books?search=bk102');
    assert.deepEqual(byId.data.data.map((book) => book.bookId), ['BK102']);

    const byTitle = await api('GET', '/api/books?search=clean');
    assert.deepEqual(byTitle.data.data.map((book) => book.bookId), ['BK101']);

    const literal = await api('GET', '/api/books?search=' + encodeURIComponent('C++'));
    assert.equal(literal.status, 200);
    assert.deepEqual(literal.data.data.map((book) => book.bookId), ['BK104']);

    const science = await api('GET', '/api/books?category=' + encodeURIComponent('Science'));
    assert.deepEqual(science.data.data.map((book) => book.bookId), ['BK103']);

    const combined = await api(
      'GET',
      '/api/books?search=pragmatic&category=' + encodeURIComponent('Computer Science')
    );
    assert.deepEqual(combined.data.data.map((book) => book.bookId), ['BK102']);

    const none = await api(
      'GET',
      '/api/books?search=hawking&category=' + encodeURIComponent('Computer Science')
    );
    assert.equal(none.status, 200);
    assert.equal(none.data.count, 0);

    const ordered = await api('GET', '/api/books');
    assert.deepEqual(
      ordered.data.data.map((book) => book.title),
      ['A Brief History of Time', 'C++ Primer', 'Clean Code', 'The Pragmatic Programmer']
    );
  });

  it('calculates dashboard statistics from the stored copies', async () => {
    const empty = await api('GET', '/api/books/stats/summary');
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.data.data, {
      totalBooks: 0,
      totalCopies: 0,
      availableCopies: 0,
      unavailableCopies: 0
    });

    await seed({ totalCopies: 5, availableCopies: 3 });
    await seed({
      bookId: 'BK102',
      title: 'The Pragmatic Programmer',
      totalCopies: 2,
      availableCopies: 0
    });
    await seed({
      bookId: 'BK103',
      title: 'A Brief History of Time',
      category: 'Science',
      totalCopies: 4,
      availableCopies: 4
    });

    const stats = await api('GET', '/api/books/stats/summary');
    assert.deepEqual(stats.data.data, {
      totalBooks: 3,
      totalCopies: 11,
      availableCopies: 7,
      unavailableCopies: 4
    });
    assert.equal(
      stats.data.data.unavailableCopies,
      stats.data.data.totalCopies - stats.data.data.availableCopies
    );

    const blocked = await api('PUT', '/api/books/BK101', { availableCopies: 9 });
    assert.equal(blocked.status, 400);
    assert.match(blocked.data.message, /cannot exceed total copies/i);

    const afterBlock = await api('GET', '/api/books/BK101');
    assert.equal(afterBlock.data.data.totalCopies, 5);
    assert.equal(afterBlock.data.data.availableCopies, 3);

    await api('PUT', '/api/books/BK102', { availableCopies: 2 });
    await api('DELETE', '/api/books/BK103');

    const next = await api('GET', '/api/books/stats/summary');
    assert.deepEqual(next.data.data, {
      totalBooks: 2,
      totalCopies: 7,
      availableCopies: 5,
      unavailableCopies: 2
    });
  });

  it('clears an optional publication year and rejects an unknown book', async () => {
    await seed();
    const cleared = await api('PUT', '/api/books/BK101', { publicationYear: '' });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.data.data.publicationYear, null);

    const missing = await api('PUT', '/api/books/BK999', { title: 'Nope' });
    assert.equal(missing.status, 404);

    const removeMissing = await api('DELETE', '/api/books/BK999');
    assert.equal(removeMissing.status, 404);
  });
});

describe('project wiring', () => {
  const root = path.join(__dirname, '..', '..');

  it('uses the same categories in the API and the form', () => {
    const backendCategories = readCategories(path.join(root, 'backend', 'models', 'Book.js'));
    const frontendCategories = readCategories(path.join(root, 'frontend', 'src', 'categories.js'));
    assert.deepEqual(frontendCategories, backendCategories);
    assert.equal(backendCategories.length, 7);
  });

  it('keeps the API URL and database name in environment variables', () => {
    const serverSource = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');
    const databaseSource = fs.readFileSync(path.join(root, 'backend', 'config', 'database.js'), 'utf8');
    const apiSource = fs.readFileSync(path.join(root, 'frontend', 'src', 'services', 'api.js'), 'utf8');
    const envExample = fs.readFileSync(path.join(root, 'backend', '.env.example'), 'utf8');

    assert.match(serverSource, /process\.env\.PORT/);
    assert.match(serverSource, /FRONTEND_URL/);
    assert.match(serverSource, /netlify\\\.app/);
    assert.match(serverSource, /localhost/);
    assert.match(serverSource, /\/api\/books/);
    assert.doesNotMatch(serverSource, /\/api\/events/);

    assert.match(databaseSource, /process\.env\.MONGODB_URI/);
    assert.match(databaseSource, /libraryDB/);
    assert.match(envExample, /MONGODB_URI=/);
    assert.match(envExample, /DB_NAME=libraryDB/);
    assert.match(envExample, /<username>:<password>/);

    assert.match(apiSource, /VITE_API_URL/);
    assert.match(apiSource, /\/api\/books/);
    assert.doesNotMatch(apiSource, /onrender\.com/);
    assert.doesNotMatch(apiSource, /\/api\/events/);
  });

  it('removes the previous subject from the active source files', () => {
    const forbidden = [
      'Campus Event',
      'campusEventDB',
      'campus-event',
      '/api/events',
      'eventAPI',
      'eventId',
      'Add Event',
      'Workshop',
      'Hackathon',
      'organizer',
      'venue'
    ];
    const files = [
      ...walk(path.join(root, 'backend')).filter((file) => !file.includes(`${path.sep}tests${path.sep}`)),
      ...walk(path.join(root, 'frontend', 'src')),
      path.join(root, 'frontend', 'index.html'),
      path.join(root, 'frontend', '.env.example'),
      path.join(root, 'README.md'),
      path.join(root, 'package.json')
    ].filter((file) => !file.endsWith('package-lock.json'));

    const hits = [];
    for (const file of files) {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
      const source = fs.readFileSync(file, 'utf8');
      for (const phrase of forbidden) {
        if (source.includes(phrase)) hits.push(`${path.relative(root, file)} -> ${phrase}`);
      }
    }

    assert.deepEqual(hits, []);
  });
});
