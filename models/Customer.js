import mongoose from 'mongoose';
const { Schema } = mongoose;

const CustomerSchema = new Schema({
    _id: { type: String, alias: 'phone' }, // Use phone number as the ID
    name: { type: String, required: true },
    cnpjCpf: { type: String },
});

CustomerSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

export default mongoose.model('Customer', CustomerSchema);
