const { User } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Login function
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Create a JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      'your_jwt_secret', // Make sure to change this secret key and store it securely
      { expiresIn: '1h' }
    );

    // Return the token
    return res.status(200).json({
      message: 'Login successful',
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error logging in', error });
  }
};

module.exports = { loginUser };
