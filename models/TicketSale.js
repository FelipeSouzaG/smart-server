
import mongoose from 'mongoose';
const { Schema } = mongoose;

// Note: We are embedding item data to keep historical accuracy of price/details at time of sale.
const SaleItemSchema = new Schema({
    item: { type: Object, required: true }, // Embedded product/service object
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    unitCost: { type: Number, default: 0 }, // Cost snapshot
    type: { type: String, required: true, enum: ['product', 'service'] },
    uniqueIdentifier: { type: String, required: false },
}, { _id: false });

const TicketSaleSchema = new Schema({
    _id: { type: String, alias: 'id' },
    items: [SaleItemSchema],
    total: { type: Number, required: true }, // Final price paid by customer
    totalCost: { type: Number, default: 0 }, // Total cost of goods sold
    discount: { type: Number, default: 0 },
    paymentMethod: { type: String },
    timestamp: { type: Date, default: Date.now },
    customerName: String,
    customerWhatsapp: String,
    customerId: { type: String, ref: 'Customer' },
    saleHour: { type: Number, required: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
});

TicketSaleSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});


export default mongoose.model('TicketSale', TicketSaleSchema);
