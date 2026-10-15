const mongoose = require('mongoose');

const CATEGORIES = [
  'Computer Science',
  'Engineering',
  'Mathematics',
  'Science',
  'Literature',
  'History',
  'Management'
];

const bookSchema = new mongoose.Schema(
  {
    bookId: {
      type: String,
      required: [true, 'Book ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true
    },
    isbn: {
      type: String,
      trim: true,
      default: '',
      maxlength: [32, 'ISBN must be 32 characters or fewer']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: CATEGORIES,
        message: 'Category must be Computer Science, Engineering, Mathematics, Science, Literature, History, or Management'
      },
      trim: true
    },
    publisher: {
      type: String,
      trim: true,
      default: ''
    },
    publicationYear: {
      type: Number,
      default: undefined,
      validate: {
        validator: (value) => value == null || (Number.isInteger(value) && value >= 1000 && value <= 2100),
        message: 'Publication year must be a whole number from 1000 to 2100'
      }
    },
    totalCopies: {
      type: Number,
      required: [true, 'Total copies is required'],
      min: [1, 'Total copies must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Total copies must be a whole number'
      }
    },
    availableCopies: {
      type: Number,
      required: [true, 'Available copies is required'],
      min: [0, 'Available copies cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Available copies must be a whole number'
      }
    }
  },
  {
    timestamps: true,
    collection: 'books'
  }
);

bookSchema.pre('validate', function (next) {
  if (
    Number.isInteger(this.totalCopies) &&
    Number.isInteger(this.availableCopies) &&
    this.availableCopies > this.totalCopies
  ) {
    this.invalidate('availableCopies', 'Available copies cannot exceed total copies');
  }
  next();
});

bookSchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.model('Book', bookSchema);
