import express from 'express';
const router = express.Router();
import PurchaseOrder from '../models/PurchaseOrder.js';
import Product from '../models/Product.js';
import CashTransaction from '../models/CashTransaction.js';
import Supplier from '../models/Supplier.js';
import { TransactionType, TransactionCategory, TransactionStatus, PaymentMethod } from '../types.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

// Helper function to apply stock and cost changes
const applyPurchaseToProducts = async (purchaseOrder) => {
    const totalItemCost = purchaseOrder.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
    const additionalCosts = purchaseOrder.freightCost + purchaseOrder.otherCost;

    for (const item of purchaseOrder.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;

        const itemProportion = totalItemCost > 0 ? (item.unitCost * item.quantity) / totalItemCost : 0;
        const dilutedCostPerItem = additionalCosts > 0 ? (itemProportion * additionalCosts) / item.quantity : 0;
        const finalUnitCost = item.unitCost + dilutedCostPerItem;

        const oldTotalCost = product.cost * product.stock;
        const newItemsTotalCost = finalUnitCost * item.quantity;
        const newStock = product.stock + item.quantity;
        const newAverageCost = newStock > 0 ? (oldTotalCost + newItemsTotalCost) / newStock : finalUnitCost;

        product.stock = newStock;
        product.cost = newAverageCost;
        await product.save();
    }
};

// Helper function to reverse stock and cost changes
const reversePurchaseFromProducts = async (purchaseOrder) => {
    const totalItemCost = purchaseOrder.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
    const additionalCosts = purchaseOrder.freightCost + purchaseOrder.otherCost;

     for (const item of purchaseOrder.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;

        const itemProportion = totalItemCost > 0 ? (item.unitCost * item.quantity) / totalItemCost : 0;
        const dilutedCostPerItem = additionalCosts > 0 ? (itemProportion * additionalCosts) / item.quantity : 0;
        const originalFinalUnitCost = item.unitCost + dilutedCostPerItem;

        const currentTotalValue = product.cost * product.stock;
        const valueOfItemsToRemove = originalFinalUnitCost * item.quantity;
        const newStock = product.stock - item.quantity;
        
        const newTotalValue = currentTotalValue - valueOfItemsToRemove;
        // prevent division by zero, and reset cost if stock is zero.
        const newAverageCost = newStock > 0 ? newTotalValue / newStock : 0;

        product.stock = newStock;
        product.cost = newStock > 0 ? newAverageCost : 0; // if stock is 0, cost should be 0.
        await product.save();
    }
};

// Helper function to create cash transactions
const createTransactionsForPurchase = (purchaseOrder) => {
    const transactionsToAdd = [];
    const { paymentDetails } = purchaseOrder;

    switch (paymentDetails.method) {
        case PaymentMethod.BANK_SLIP:
            paymentDetails.installments.forEach(inst => {
                transactionsToAdd.push({
                    description: `Compra #${purchaseOrder.id} (${inst.installmentNumber}/${paymentDetails.installments.length}) - ${purchaseOrder.supplierInfo.name}`,
                    amount: inst.amount,
                    type: TransactionType.EXPENSE,
                    category: TransactionCategory.PRODUCT_PURCHASE,
                    status: TransactionStatus.PENDING,
                    dueDate: inst.dueDate,
                    timestamp: inst.dueDate,
                    purchaseId: purchaseOrder.id
                });
            });
            break;
        default:
             transactionsToAdd.push({
                 description: `Compra #${purchaseOrder.id} (${paymentDetails.method}) - ${purchaseOrder.supplierInfo.name}`,
                 amount: purchaseOrder.totalCost,
                 type: TransactionType.EXPENSE,
                 category: TransactionCategory.PRODUCT_PURCHASE,
                 status: TransactionStatus.PAID,
                 timestamp: paymentDetails.paymentDate,
                 dueDate: paymentDetails.paymentDate,
                 purchaseId: purchaseOrder.id
             });
             break;
    }
    return transactionsToAdd;
};

// GET all purchase orders
router.get('/', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const purchases = await PurchaseOrder.find({}).sort({ createdAt: -1 });
        res.json(purchases);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new purchase order
router.post('/', protect, authorize('owner', 'manager'), async (req, res) => {
    const { items, supplierInfo, reference } = req.body;
    if (!items || items.length === 0 || !supplierInfo || !reference) {
        return res.status(400).json({ message: 'Dados da compra incompletos.' });
    }
    try {
        const count = await PurchaseOrder.countDocuments();
        const newId = `PO-${(count + Date.now()).toString().slice(-4)}`;
        
        const { ...purchaseData } = req.body;

        // Supplier Upsert Logic
        if (supplierInfo && supplierInfo.cnpjCpf && supplierInfo.name && supplierInfo.phone) {
            const cleanedCnpjCpf = supplierInfo.cnpjCpf.replace(/\D/g, '');
            await Supplier.findByIdAndUpdate(
                cleanedCnpjCpf,
                {
                    name: supplierInfo.name,
                    contactPerson: supplierInfo.contactPerson,
                    phone: supplierInfo.phone
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }
        
        const newPurchaseOrder = new PurchaseOrder({
            _id: newId,
            supplierInfo,
            ...purchaseData,
            createdAt: new Date()
        });
        
        await applyPurchaseToProducts(newPurchaseOrder);
        const transactions = createTransactionsForPurchase(newPurchaseOrder);
        if (transactions.length > 0) {
            await CashTransaction.insertMany(transactions);
        }

        const savedPurchase = await newPurchaseOrder.save();
        res.status(201).json(savedPurchase);

    } catch (err) {
        console.error("Error creating purchase:", err);
        res.status(400).json({ message: err.message });
    }
});

// PUT (update) a purchase order
router.put('/:id', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const originalPO = await PurchaseOrder.findById(req.params.id);
        if (!originalPO) return res.status(404).json({ message: 'Purchase Order not found' });
        
        // Reverse old state
        await reversePurchaseFromProducts(originalPO);
        await CashTransaction.deleteMany({ purchaseId: originalPO.id });

        // Apply new state
        const { supplierInfo, ...purchaseData } = req.body;
        // Supplier Upsert Logic
        if (supplierInfo && supplierInfo.cnpjCpf && supplierInfo.name && supplierInfo.phone) {
            const cleanedCnpjCpf = supplierInfo.cnpjCpf.replace(/\D/g, '');
            await Supplier.findByIdAndUpdate(
                cleanedCnpjCpf,
                {
                    name: supplierInfo.name,
                    contactPerson: supplierInfo.contactPerson,
                    phone: supplierInfo.phone
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        const updatedPOData = { supplierInfo, ...purchaseData };
        await applyPurchaseToProducts(updatedPOData);
        const transactions = createTransactionsForPurchase(updatedPOData);
        if (transactions.length > 0) {
            await CashTransaction.insertMany(transactions);
        }

        const updatedPurchase = await PurchaseOrder.findByIdAndUpdate(req.params.id, updatedPOData, { new: true });
        res.json(updatedPurchase);

    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


// DELETE a purchase order
router.delete('/:id', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        const poToDelete = await PurchaseOrder.findById(req.params.id);
        if (!poToDelete) return res.status(404).json({ message: 'Purchase Order not found' });

        await reversePurchaseFromProducts(poToDelete);
        await CashTransaction.deleteMany({ purchaseId: poToDelete.id });
        await PurchaseOrder.findByIdAndDelete(req.params.id);

        res.json({ message: 'Purchase Order deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


export default router;