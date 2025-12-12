const express = require("express");
const router = express.Router();
const supabase = require("../../config/supabase"); 

router.post("/", async (req, res) => {
    const { email, password } = req.body;

    // ---------- LOGIN ----------
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    // ---------- FETCH USER PROFILE ----------
    const { data: userData, error: userError } = await supabase
        .from("users")
        .select("user_id, name, email, dept, role")
        .eq("user_id", data.user.id)
        .single();

    if (userError) {
        return res.status(500).json({ message: "Error fetching user details" });
    }

    // ---------- REDIRECT BASED ON ROLE ----------
    let redirectTo = "/home";
    if (userData.role === "HOD") redirectTo = "/hod/home";
    if (userData.role === "Admin") redirectTo = "/admin/home";

    // ---------- SEND TOKEN + PROFILE TO FRONTEND ----------
    return res.json({
        message: "Login successful",
        user: data.user,
        profile: userData,
        token: data.session.access_token,        // 🔥 required
        refreshToken: data.session.refresh_token, // optional but useful
        redirectTo
    });
});

module.exports = router;
