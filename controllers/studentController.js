const { User } = require('../models');
const bcrypt = require('bcrypt');

exports.registerStudent = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ name, email, password: hashedPassword, role: 'student' });

        res.status(201).json({ message: 'User registered successfully!', user: newUser });
    } catch (error) {
        console.error('Error during registration:', error);  // Log the full error
        res.status(500).json({ message: 'Error registering user', error: error.message });
    }
};

exports.loginStudent = async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ where: { email, role: 'student' } });
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
          return res.status(401).json({ message: "Incorrect password" });
      }
  
      res.status(200).json({ message: "Login successful", user });
    } catch (error) {
      res.status(500).json({ message: "Error logging in", error });
    }
  };
  
