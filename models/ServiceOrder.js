import mongoose from 'mongoose';
const { Schema } = mongoose;

const ServiceOrderSchema = new Schema({
    _id: { type: String, alias: 'id' },
    customerName: { type: String, required: true },
    customerWhatsapp: { type: String, required: true },
    customerContact: String,
    customerId: { type: String, ref: 'Customer' },
    customerCnpjCpf: String,
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceDescription: { type: String, required: true },
    totalPrice: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    otherCosts: { type: Number, default: 0 },
    status: { type: String, required: true, default: 'Pendente' },
    createdAt: { type: Date, default: Date.now },
    completedAt: Date,
});

ServiceOrderSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});


export default mongoose.model('ServiceOrder', ServiceOrderSchema);