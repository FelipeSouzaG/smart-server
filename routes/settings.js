import express from 'express';
const router = express.Router();
import StoreConfig from '../models/StoreConfig.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

// GET global settings
router.get('/', protect, async (req, res) => {
    try {
        // Try to find the existing config
        let config = await StoreConfig.findOne();
        
        // If no config exists yet (first run), return default values (handled by Mongoose schema defaults)
        // We don't save it yet, the frontend will trigger a save eventually, or we can save defaults now.
        if (!config) {
            config = new StoreConfig();
            // Optional: save defaults immediately so ID exists
            await config.save();
        }
        
        res.json(config);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT update global settings
router.put('/', protect, authorize('owner', 'manager'), async (req, res) => {
    try {
        // Since we want a singleton, we use findOneAndUpdate with upsert
        // We don't need an ID in the param because there's only one config.
        // However, finding by "empty filter" gives the first document.
        
        let config = await StoreConfig.findOne();
        
        if (!config) {
            config = new StoreConfig(req.body);
            await config.save();
        } else {
            // Update fields
            Object.assign(config, req.body);
            await config.save();
        }

        res.json(config);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
