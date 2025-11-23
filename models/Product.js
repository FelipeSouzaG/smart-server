import mongoose from 'mongoose';
const { Schema } = mongoose;

const ProductSchema = new Schema({
    _id: { type: String, alias: 'id' }, // Use barcode as the ID
    barcode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    cost: { type: Number, required: true, default: 0 },
    stock: { type: Number, required: true, default: 0 },
    lastSold: { type: Date, default: null },
    location: String,
    category: { type: String, required: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    requiresUniqueIdentifier: { type: Boolean, default: false },
});

// Mongoose virtuals do not work well with toJSON on the client side without extra config.
// Using alias is simpler for this use case.
ProductSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

export default mongoose.model('Product', ProductSchema);