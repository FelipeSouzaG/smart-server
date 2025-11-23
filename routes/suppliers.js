import express from 'express';
const router = express.Router();
import Supplier from '../models/Supplier.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

// GET all suppliers
router.get('/', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const suppliers = await Supplier.find({}).sort({ name: 1 });
        res.json(suppliers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET a supplier by CNPJ/CPF
router.get('/:cnpjCpf', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const cleanedCnpjCpf = req.params.cnpjCpf.replace(/\D/g, '');
        const supplier = await Supplier.findById(cleanedCnpjCpf);
        if (!supplier) {
            return res.status(404).json({ message: 'Fornecedor não encontrado.' });
        }
        res.json(supplier);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new supplier
router.post('/', protect, authorize('owner', 'manager'), async (req, res) => {
    const { cnpjCpf, name, contactPerson, phone } = req.body;
     if (!cnpjCpf || !name || !phone) {
        return res.status(400).json({ message: 'Nome, CPF/CNPJ e Telefone são obrigatórios.' });
    }
    const cleanedId = cnpjCpf.replace(/\D/g, '');

    try {
        const existingSupplier = await Supplier.findById(cleanedId);
        if (existingSupplier) {
            return res.status(400).json({ message: 'Fornecedor com este CPF/CNPJ já existe.' });
        }

        const newSupplier = new Supplier({
            _id: cleanedId,
            name,
            contactPerson,
            phone
        });

        const savedSupplier = await newSupplier.save();
        res.status(201).json(savedSupplier);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT (update) a supplier
router.put('/:cnpjCpf', protect, authorize('owner', 'manager'), async (req, res) => {
     if (!req.body.name || !req.body.phone) {
        return res.status(400).json({ message: 'Nome e Telefone são obrigatórios.' });
    }
    try {
        const cleanedId = req.params.cnpjCpf.replace(/\D/g, '');
        const updatedSupplier = await Supplier.findByIdAndUpdate(
            cleanedId,
            req.body,
            { new: true }
        );
        if (!updatedSupplier) {
            return res.status(404).json({ message: 'Fornecedor não encontrado.' });
        }
        res.json(updatedSupplier);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a supplier
router.delete('/:cnpjCpf', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const cleanedId = req.params.cnpjCpf.replace(/\D/g, '');
        const supplier = await Supplier.findByIdAndDelete(cleanedId);
        if (!supplier) {
            return res.status(404).json({ message: 'Fornecedor não encontrado.' });
        }
        res.json({ message: 'Fornecedor excluído com sucesso.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;