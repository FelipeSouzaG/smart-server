import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Function to generate JWT
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '1d', // Token expires in 1 day
    });
};

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Por favor, forneça email e senha.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        
        const token = generateToken(user._id, user.role);
        res.json({ token, user: user.toJSON() });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

// @route   GET api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, async (req, res) => {
    // req.user is attached by the 'protect' middleware
    res.status(200).json(req.user);
});

// @route   GET api/auth/system-status
// @desc    Check if any user exists in the system
// @access  Public
router.get('/system-status', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        res.json({ userCount });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao verificar o status do sistema.' });
    }
});

export default router;