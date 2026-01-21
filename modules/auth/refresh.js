const express = require("express");
const router = express.Router();
const supabase = require("../../config/supabase");

router.post("/", async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token is required" });
    }

    const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
    });

    if (error) {
        return res.status(401).json({ message: "Invalid refresh token" });
    }

    return res.json({
        token: data.session.access_token,
        refreshToken: data.session.refresh_token
    });
});

module.exports = router;