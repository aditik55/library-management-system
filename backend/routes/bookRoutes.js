const express = require('express');
const router = express.Router();
const {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getBookStats
} = require('../controllers/bookController');

// Registered before /:id so "stats" is not treated as a book id.
router.get('/stats/summary', getBookStats);

router.route('/')
  .get(getAllBooks)
  .post(createBook);

router.route('/:id')
  .get(getBookById)
  .put(updateBook)
  .delete(deleteBook);

module.exports = router;
