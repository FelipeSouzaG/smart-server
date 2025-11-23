import express from 'express';
const router = express.Router();
import Customer from '../models/Customer.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

// GET /api/customers/:phone - Find customer by phone
router.get('/:phone', protect, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.phone);
        if (!customer) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        res.json(customer);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/customers - Create a new customer (can be used for manual creation if needed)
router.post('/', protect, async (req, res) => {
    const { phone, name, cnpjCpf } = req.body;
    if (!phone || !name) {
        return res.status(400).json({ message: 'Nome e telefone são obrigatórios.' });
    }
    const cleanedPhone = phone.replace(/\D/g, '');
    
    try {
         const existingCustomer = await Customer.findById(cleanedPhone);
        if (existingCustomer) {
            return res.status(400).json({ message: 'Cliente com este telefone já existe.' });
        }
        // Use the phone number from the body as the _id
        const customer = new Customer({ _id: cleanedPhone, name, cnpjCpf });
        const newCustomer = await customer.save();
        res.status(201).json(newCustomer);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// GET /api/customers - Get all customers
router.get('/', protect, async (req, res) => {
  try {
    const customers = await Customer.find({}).sort({ name: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/customers/:phone - Update a customer
router.put('/:phone', protect, async (req, res) => {
    try {
        const { name, cnpjCpf } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'O nome é obrigatório.' });
        }
        // The phone/ID cannot be changed.
        const updatedCustomer = await Customer.findByIdAndUpdate(
            req.params.phone,
            { name, cnpjCpf },
            { new: true, runValidators: true }
        );
        if (!updatedCustomer) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        res.json(updatedCustomer);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE /api/customers/:phone - Delete a customer
router.delete('/:phone', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const customer = await Customer.findByIdAndDelete(req.params.phone);
        if (!customer) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        // Note: We are not deleting associated sales/orders, just the customer record.
        res.json({ message: 'Cliente excluído com sucesso.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;