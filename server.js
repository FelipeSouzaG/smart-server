import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

import productsRouter from './routes/products.js';
import servicesRouter from './routes/services.js';
import serviceOrdersRouter from './routes/serviceOrders.js';
import purchasesRouter from './routes/purchases.js';
import transactionsRouter from './routes/transactions.js';
import salesRouter from './routes/sales.js';
import insightsRouter from './routes/insights.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import customersRouter from './routes/customers.js';
import suppliersRouter from './routes/suppliers.js';

const app = express();
const PORT = process.env.PORT || 5000;

/* -------------------------------
   CORS — permitir apenas frontend
-------------------------------- */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  })
);

/* -------------------------------
   Segurança
-------------------------------- */
app.use(helmet());
app.use(express.json());
app.use(mongoSanitize());

/* -------------------------------
   Rate Limiting
-------------------------------- */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

/* -------------------------------
   MongoDB
-------------------------------- */
mongoose.set('strictQuery', true);

mongoose
  .connect(process.env.MONGODB_URI, {
    autoIndex: true,
  })
  .then(() => console.log('MongoDB connected successfully.'))
  .catch((err) => console.error('MongoDB connection error:', err));

/* -------------------------------
   Health Check
-------------------------------- */
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Smart Store API is running...',
    uptime: process.uptime(),
  });
});

/* -------------------------------
   Routes
-------------------------------- */
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/service-orders', serviceOrdersRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/suppliers', suppliersRouter);

/* -------------------------------
   Start Server
-------------------------------- */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
