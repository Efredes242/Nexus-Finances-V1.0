-- Migration number: 0001 	 2024-01-29T12:00:00Z
DROP TABLE IF EXISTS entries;
DROP TABLE IF EXISTS goals;
DROP TABLE IF EXISTS installments;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS user_configs;
DROP TABLE IF EXISTS category_budgets;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'user',
  must_change_password INTEGER DEFAULT 0,
  email TEXT,
  google_id TEXT,
  avatar TEXT,
  firstName TEXT,
  lastName TEXT,
  birthDate TEXT
);

CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  name TEXT,
  amount REAL,
  category TEXT,
  tag TEXT,
  date TEXT,
  status TEXT,
  paymentMethod TEXT,
  month_year TEXT,
  cardName TEXT,
  financingPlan TEXT,
  originalAmount REAL,
  currency TEXT,
  exchangeRateEstimated REAL,
  exchangeRateActual REAL,
  is_provisional INTEGER DEFAULT 0,
  user_id TEXT,
  linked_income_id TEXT,
  application TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  name TEXT,
  targetAmount REAL,
  currentAmount REAL,
  deadline TEXT,
  icon TEXT,
  user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE installments (
  id TEXT PRIMARY KEY,
  name TEXT,
  totalAmount REAL,
  installments INTEGER,
  startDate TEXT,
  description TEXT,
  category TEXT,
  cardName TEXT,
  user_id TEXT,
  linked_income_id TEXT,
  application TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE user_configs (
  user_id TEXT PRIMARY KEY,
  currency TEXT,
  categories TEXT,
  creditCards TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE category_budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  category TEXT,
  amount REAL,
  UNIQUE(user_id, category),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
