import express from 'express';
const router = express.Router();
import CashTransaction from '../models/CashTransaction.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

// GET all transactions
router.get('/', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const transactions = await CashTransaction.find({}).sort({ timestamp: -1 });
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new transaction (for manual costs)
router.post('/', protect, authorize('owner', 'manager'), async (req, res) => {
    const { description, amount, category } = req.body;
    if (!description || !amount || !category) {
        return res.status(400).json({ message: 'Descrição, valor e categoria são obrigatórios.' });
    }

    const transaction = new CashTransaction({
        ...req.body,
        timestamp: req.body.dueDate || new Date(),
    });

    try {
        const newTransaction = await transaction.save();
        res.status(201).json(newTransaction);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT (update) a transaction
router.put('/:id', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const updatedTransaction = await CashTransaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedTransaction) return res.status(404).json({ message: 'Transaction not found' });
        res.json(updatedTransaction);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a transaction
router.delete('/:id', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const transaction = await CashTransaction.findByIdAndDelete(req.params.id);
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
        res.json({ message: 'Transaction deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;