import mongoose from 'mongoose';
const { Schema } = mongoose;

const CashTransactionSchema = new Schema({
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, required: true },
    category: { type: String, required: true },
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    dueDate: Date,
    serviceOrderId: String,
    purchaseId: String, // Link to purchase order
    saleId: String, // Link to sale ticket
});

CashTransactionSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

export default mongoose.model('CashTransaction', CashTransactionSchema);