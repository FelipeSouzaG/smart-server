
import express from 'express';
const router = express.Router();
import ServiceOrder from '../models/ServiceOrder.js';
import Customer from '../models/Customer.js';
import CashTransaction from '../models/CashTransaction.js';
import { TransactionType, TransactionCategory, TransactionStatus, ServiceOrderStatus } from '../types.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

// GET all service orders
router.get('/', protect, async (req, res) => {
    try {
        const serviceOrders = await ServiceOrder.find({}).sort({ createdAt: -1 });
        res.json(serviceOrders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new service order
router.post('/', protect, authorize('owner', 'manager', 'technician'), async (req, res) => {
    const { customerName, customerWhatsapp, customerCnpjCpf, ...orderData } = req.body;
    
    // Generate new ID
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const count = await ServiceOrder.countDocuments({ _id: new RegExp(`^OS-${year}${month}`) });
    const sequentialId = (count + 1).toString().padStart(4, '0');
    const newOrderId = `OS-${year}${month}${sequentialId}`;

    try {
        // Customer Upsert Logic
        let customerId = null;
        if (customerWhatsapp && customerName) {
            const cleanedPhone = customerWhatsapp.replace(/\D/g, '');
            const customer = await Customer.findByIdAndUpdate(
                cleanedPhone,
                { name: customerName, cnpjCpf: customerCnpjCpf || '' },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            customerId = customer.id;
        }

        const newOrder = new ServiceOrder({
            _id: newOrderId,
            customerName,
            customerWhatsapp,
            customerCnpjCpf,
            customerId,
            ...orderData,
            status: ServiceOrderStatus.PENDING,
            createdAt: now,
        });

        const savedOrder = await newOrder.save();
        res.status(201).json(savedOrder);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT (update) a service order
router.put('/:id', protect, authorize('owner', 'manager', 'technician'), async (req, res) => {
    const { customerName, customerWhatsapp, customerCnpjCpf, ...orderData } = req.body;
    try {
        const order = await ServiceOrder.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Ordem de Serviço não encontrada.' });
        }

        if (req.user.role === 'technician' && order.status === ServiceOrderStatus.COMPLETED) {
            return res.status(403).json({ message: 'Técnicos não podem editar Ordens de Serviço concluídas.' });
        }

        // Customer Upsert Logic
        let customerId = orderData.customerId; // Keep existing if not changed
        if (customerWhatsapp && customerName) {
            const cleanedPhone = customerWhatsapp.replace(/\D/g, '');
            const customer = await Customer.findByIdAndUpdate(
                cleanedPhone,
                { name: customerName, cnpjCpf: customerCnpjCpf || '' },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            customerId = customer.id;
        }
        
        const updatePayload = {
            customerName,
            customerWhatsapp,
            customerCnpjCpf,
            customerId,
            ...orderData
        };

        const updatedOrder = await ServiceOrder.findByIdAndUpdate(req.params.id, updatePayload, { new: true });
        if (!updatedOrder) return res.status(404).json({ message: 'Service Order not found' });
        res.json(updatedOrder);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a service order
router.delete('/:id', protect, authorize('owner', 'manager', 'technician'), async (req, res) => {
    try {
        const order = await ServiceOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Ordem de Serviço não encontrada.' });

        // Technicians can only delete PENDING orders.
        if (req.user.role === 'technician' && order.status !== ServiceOrderStatus.PENDING) {
            return res.status(403).json({ message: 'Técnicos só podem excluir Ordens de Serviço com status "Pendente".' });
        }

        // Also delete associated transactions
        await CashTransaction.deleteMany({ serviceOrderId: req.params.id });
        await ServiceOrder.findByIdAndDelete(req.params.id);
        
        res.json({ message: 'Ordem de Serviço e transações associadas foram excluídas com sucesso.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST toggle status of a service order
router.post('/:id/toggle-status', protect, authorize('owner', 'manager', 'technician'), async (req, res) => {
    const { paymentMethod, discount, finalPrice } = req.body;

    try {
        const order = await ServiceOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Service Order not found' });

        if (order.status === ServiceOrderStatus.PENDING) {
            // Completing the order
            order.status = ServiceOrderStatus.COMPLETED;
            order.completedAt = new Date();
            
            // Update financial details if provided
            if (finalPrice !== undefined) order.finalPrice = finalPrice;
            if (discount !== undefined) order.discount = discount;
            if (paymentMethod) order.paymentMethod = paymentMethod;

            const transactionsToAdd = [
                {
                    description: `Faturamento OS #${order.id} - ${order.serviceDescription}`,
                    amount: finalPrice !== undefined ? finalPrice : order.totalPrice, // Use paid amount
                    type: TransactionType.INCOME,
                    category: TransactionCategory.SERVICE_REVENUE,
                    status: TransactionStatus.PAID,
                    timestamp: new Date(),
                    serviceOrderId: order.id
                },
                {
                    description: `Custo OS #${order.id} - ${order.serviceDescription}`,
                    amount: order.totalCost,
                    type: TransactionType.EXPENSE,
                    category: TransactionCategory.SERVICE_COST,
                    status: TransactionStatus.PENDING,
                    timestamp: new Date(),
                    serviceOrderId: order.id
                }
            ];
            await CashTransaction.insertMany(transactionsToAdd);

        } else { // It's COMPLETED, attempt to revert to PENDING
             // Technicians are not allowed to reopen a completed order.
            if (req.user.role === 'technician') {
                return res.status(403).json({ message: 'Técnicos não têm permissão para reabrir uma Ordem de Serviço concluída.' });
            }
            order.status = ServiceOrderStatus.PENDING;
            order.completedAt = undefined;
            // Clear financial info on reopen
            order.finalPrice = undefined;
            order.discount = undefined;
            order.paymentMethod = undefined;

            await CashTransaction.deleteMany({ serviceOrderId: order.id });
        }

        const updatedOrder = await order.save();
        res.json(updatedOrder);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
