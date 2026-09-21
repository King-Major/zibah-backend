const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { verifyToken, verifyAdmin, optionalAuth } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const { feedbackLimiter } = require('../middleware/security');
const { serializeFeedback } = require('../utils/serializers');
const { cleanString, isValidEmail, isId } = require('../utils/helpers');

// POST /api/feedbacks - Submit feedback (PUBLIC, rate-limited)
router.post('/', feedbackLimiter, optionalAuth, async (req, res) => {
  const name = cleanString(req.body.name);
  const email = cleanString(req.body.email).toLowerCase();
  const message = cleanString(req.body.message);

  if (!message) return res.status(400).json({ message: 'Feedback message is required' });
  if (!name) return res.status(400).json({ message: 'Name is required' });
  if (!email) return res.status(400).json({ message: 'Email is required' });
  if (!isValidEmail(email)) return res.status(400).json({ message: 'Please provide a valid email' });
  if (message.length > 2000) return res.status(400).json({ message: 'Feedback is too long (max 2000 characters)' });

  const parsed = parseInt(req.body.rating, 10);
  const rating = Number.isNaN(parsed) ? 5 : Math.min(Math.max(parsed, 1), 5);

  // Take the user from the verified token – a body-supplied user_id can be spoofed
  const user = req.user && isId(String(req.user.id)) ? req.user.id : null;

  const feedback = await Feedback.create({ user, name, email, message, rating });

  res.status(201).json({
    message: 'Thank you for your feedback! We appreciate your support.',
    feedback: serializeFeedback(feedback),
  });
});

// GET /api/feedbacks - (ADMIN)
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  const feedbacks = await Feedback.find().sort({ createdAt: -1 }).lean();
  res.json(feedbacks.map(serializeFeedback));
});

// DELETE /api/feedbacks/:id - (ADMIN)
router.delete('/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  const deleted = await Feedback.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Feedback not found' });

  res.json({ message: 'Feedback deleted successfully', id: String(deleted._id) });
});

module.exports = router;
