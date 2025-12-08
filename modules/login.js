const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase"); // your file

router.post("/", async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({ message: "Login successful", user: data.user });
});

module.exports = router;
