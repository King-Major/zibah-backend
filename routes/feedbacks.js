const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/feedbacks - Submit a new feedback
router.post('/', async (req, res) => {
  try {
    const { user_id, name, email, message, rating } = req.body;

    // Validation
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Feedback message is required' });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!email || email.trim().length === 0) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const feedbackRating = rating ? Math.min(Math.max(parseInt(rating), 1), 5) : 5;

    const query = `
      INSERT INTO feedbacks (user_id, name, email, message, rating)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, name, email, message, rating, created_at
    `;

    const result = await pool.query(query, [user_id || null, name, email, message, feedbackRating]);

    res.status(201).json({
      message: 'Thank you for your feedback! We appreciate your support.',
      feedback: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ message: 'Failed to submit feedback' });
  }
});

// GET /api/feedbacks - Get all feedbacks (Admin only)
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT id, user_id, name, email, message, rating, created_at
      FROM feedbacks
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    res.status(500).json({ message: 'Failed to fetch feedbacks' });
  }
});

// DELETE /api/feedbacks/:id - Delete a feedback
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM feedbacks WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    res.json({ message: 'Feedback deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ message: 'Failed to delete feedback' });
  }
});

module.exports = router;
