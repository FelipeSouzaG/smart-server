import express from 'express';
const router = express.Router();
import Product from '../models/Product.js';
import { protect, authorize } from '../middleware/authMiddleware.js';


// GET all products
router.get('/', protect, async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new product
router.post('/', protect, authorize('owner', 'manager'), async (req, res) => {
    const { id, brand, model, price, category } = req.body;
    if (!id || !brand || !model || !price || !category) {
        return res.status(400).json({ message: 'Campos obrigatórios estão faltando.' });
    }

    const product = new Product({
        _id: id,
        barcode: id,
        ...req.body
    });

    try {
        const newProduct = await product.save();
        res.status(201).json(newProduct);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Um produto com este código de barras já existe.' });
        }
        res.status(400).json({ message: err.message });
    }
});

// PUT (update) a product
router.put('/:id', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });
        res.json(updatedProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a product
router.delete('/:id', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


export default router;