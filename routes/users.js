import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

// @route   POST api/users/setup-owner
// @desc    Register the first user as 'owner'
// @access  Public (only if no users exist)
router.post('/setup-owner', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: 'Nome, email e senha são obrigatórios.' });
  }

  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return res
        .status(403)
        .json({
          message: 'O sistema já possui um administrador. Use a tela de login.',
        });
    }

    const user = new User({ name, email, password, role: 'owner' });
    await user.save();

    const token = generateToken(user._id, user.role);
    res.status(201).json({ token, user: user.toJSON() });
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .json({ message: 'Erro no servidor ao registrar o administrador.' });
  }
});

// @route   POST api/users
// @desc    Register a new user
// @access  Private (Owner only)
router.post('/', protect, authorize('owner'), async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res
      .status(400)
      .json({ message: 'Todos os campos são obrigatórios.' });
  }

  if (role === 'owner') {
    return res
      .status(400)
      .json({ message: "Não é possível criar outro usuário 'owner'." });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ message: 'Usuário com este email já existe.' });
    }

    const user = await User.create({ name, email, password, role });
    res.status(201).json(user.toJSON());
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Erro no servidor ao registrar usuário.' });
  }
});

// @route   GET api/users
// @desc    Get all users
// @access  Private (Owner only)
router.get('/', protect, authorize('owner', 'manager'), async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   PUT api/users/profile
// @desc    Update logged-in user's own profile
// @access  Private (Any authenticated user)
router.put('/profile', protect, async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    user.name = name || user.name;
    user.email = email || user.email;

    if (password) {
      user.password = password;
    }

    const updatedUser = await user.save();
    res.json(updatedUser.toJSON());
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: 'Este email já está em uso por outro usuário.' });
    }
    console.error(err.message);
    res
      .status(500)
      .json({ message: 'Erro no servidor ao atualizar o perfil.' });
  }
});

// @route   PUT api/users/:id
// @desc    Update a user
// @access  Private (Owner)
router.put('/:id', protect, authorize('owner'), async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !role) {
    return res
      .status(400)
      .json({ message: 'Nome, email e função são obrigatórios.' });
  }

  try {
    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (user.role === 'owner' && role !== 'owner') {
      return res
        .status(400)
        .json({
          message: 'A função do usuário "owner" não pode ser alterada.',
        });
    }

    user.name = name;
    user.email = email;
    user.role = role;

    if (password) {
      user.password = password;
    }

    await user.save();
    res.json(user.toJSON());
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: 'Este email já está em uso por outro usuário.' });
    }
    console.error(err.message);
    res.status(500).json({ message: 'Erro no servidor ao atualizar usuário.' });
  }
});

// @route   DELETE api/users/:id
// @desc    Delete a user
// @access  Private (Owner)
router.delete('/:id', protect, authorize('owner'), async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (userToDelete.role === 'owner') {
      return res
        .status(400)
        .json({ message: 'O usuário "owner" não pode ser excluído.' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Usuário deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
