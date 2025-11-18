import express from 'express';
import mongoose from 'mongoose';
import TicketSale from '../models/TicketSale.js';
import Product from '../models/Product.js';
import CashTransaction from '../models/CashTransaction.js';
import Customer from '../models/Customer.js';
import { TransactionType, TransactionCategory, TransactionStatus } from '../types.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all sales
router.get('/', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const sales = await TicketSale.find({}).sort({ timestamp: -1 });
        res.json(sales);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// POST a new sale
router.post('/', protect, async (req, res) => {
    const { items, total, customerName, customerWhatsapp, customerCnpjCpf } = req.body;
    const { id: userId, name: userName } = req.user; // Get user from protect middleware
    const now = new Date();

    if (!items || items.length === 0 || !total) {
        return res.status(400).json({ message: 'Dados da venda incompletos.' });
    }

    try {
        // 1. Upsert customer
        let customerId = null;
        if (customerWhatsapp && customerName) {
            const cleanedPhone = customerWhatsapp.replace(/\D/g, '');
            const customer = await Customer.findByIdAndUpdate(
                cleanedPhone,
                { name: customerName, cnpjCpf: customerCnpjCpf },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            customerId = customer.id;
        }

        // 2. Generate new Ticket ID
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `TC-${year}${month}-`;
        const lastSale = await TicketSale.findOne({ _id: new RegExp(`^${prefix}`) }).sort({ _id: -1 });

        let nextSequence = 1;
        if (lastSale) {
            const lastSequence = parseInt(lastSale.id.split('-')[2], 10);
            nextSequence = lastSequence + 1;
        }
        const newTicketId = `${prefix}${nextSequence.toString().padStart(4, '0')}`;

        // 3. Update product stock
        for (const saleItem of items) {
            if (saleItem.type === 'product') {
                await Product.findByIdAndUpdate(saleItem.item.id, {
                    $inc: { stock: -saleItem.quantity },
                    $set: { lastSold: now }
                });
            }
        }
        
        // 4. Create financial transaction
        const newTransaction = new CashTransaction({
            description: `Venda #${newTicketId}`,
            amount: total,
            type: TransactionType.INCOME,
            category: TransactionCategory.SALES_REVENUE,
            status: TransactionStatus.PAID,
            timestamp: now,
            dueDate: now,
            saleId: newTicketId
        });
        await newTransaction.save();

        // 5. Create and save the new sale
        const newSale = new TicketSale({
            _id: newTicketId,
            items,
            total,
            customerName,
            customerWhatsapp,
            customerId,
            userId,
            userName,
            timestamp: now,
            saleHour: now.getHours(),
        });

        const savedSale = await newSale.save();
        res.status(201).json(savedSale);

    } catch (err) {
        console.error("Error creating sale:", err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE a sale by ID
router.delete('/:id', protect, authorize('owner', 'manager'), async (req, res) => {
    const { id } = req.params;
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const sale = await TicketSale.findById(id).session(session);
            if (!sale) {
                // This will abort the transaction
                throw new Error('Sale not found');
            }

            // Step 1: Revert stock for each product in the sale
            for (const item of sale.items) {
                if (item.type === 'product') {
                    await Product.findByIdAndUpdate(item.item.id,
                        { $inc: { stock: item.quantity } },
                        { session }
                    );
                }
            }

            // Step 2: Delete the associated cash transaction
            await CashTransaction.deleteOne({ saleId: id }).session(session);

            // Step 3: Delete the sale ticket itself
            await TicketSale.findByIdAndDelete(id).session(session);
        });
        
        res.json({ message: 'Venda excluída com sucesso.' });

    } catch (error) {
        console.error('Error deleting sale:', error.message);
        if (error.message === 'Sale not found') {
            return res.status(404).json({ message: 'Venda não encontrada.' });
        }
        res.status(500).json({ message: 'Ocorreu um erro no servidor ao excluir a venda.' });
    } finally {
        session.endSession();
    }
});

export default router;