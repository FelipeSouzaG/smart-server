import mongoose from 'mongoose';
const { Schema } = mongoose;

const SupplierSchema = new Schema({
    _id: { type: String, alias: 'cnpjCpf' }, // Use CNPJ/CPF as the ID
    name: { type: String, required: true },
    contactPerson: String,
    phone: { type: String, required: true },
});

SupplierSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

export default mongoose.model('Supplier', SupplierSchema);