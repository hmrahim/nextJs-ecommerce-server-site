// controllers/auth.controller.js
const bcrypt = require("bcryptjs")
const User = require("../models/User");



exports.signupController = async (req, res) => {
   
   
    try {
        const { firstName, lastName, email,phone, password } = req.body

        const existing = await User.findOne({ email })
        if (existing) {
            return res.status(400).json({ message: "Email already registered" })
        }

        const hashed = await bcrypt.hash(password, 10)
        const user = new User({ firstName, lastName, email, phone, passwordHash: hashed })
        await user.save()

        res.status(201).json({
            message: "User created",
            user:user,
        })
    } catch (err) {
        res.status(500).json({ message: err.message || "Server error" })
    }
}

exports.signinController = async (req, res) => {
    console.log(req.body);

    try {
        const { email, password } = req.body

        const user = await User.findOne({ email }).select("+passwordHash")
        // console.log(user);

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" })
        }
     
        const isMatch = await bcrypt.compare(password, user.passwordHash)
        console.log("isMatch:", isMatch);
        if (!isMatch) {
            
            return res.status(401).json({ message: "Invalid credentials" })
        }

        res.json({
            id: user._id,
            name: user.firstName + " " + user.lastName,
            email: user.email,
        })
    } catch (err) {
        res.status(500).json({ message: "Server error" })
    }
}