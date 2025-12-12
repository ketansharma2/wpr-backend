const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Add new member
router.post("/add", async (req, res) => {
  try {
    const { email, password, name, dept, role, user_type } = req.body;

    // Validate required fields
    if (!email || !password || !name || !dept || !role || !user_type) {
      return res.status(400).json({
        error: "All fields are required: email, password, name, dept, role, user_type"
      });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          dept,
          role,
          user_type
        }
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: "Failed to create user account" });
    }

    const userId = authData.user.id;

    // Add user details to users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert([
        {
          user_id: userId,
          name,
          email,
          dept,
          role,
          user_type
        }
      ]);

    if (userError) {
      // If users table insert fails, we should ideally clean up the auth user
      // But for now, just return the error
      return res.status(400).json({ error: userError.message });
    }

    res.json({
      message: "Member added successfully",
      user: {
        user_id: userId,
        name,
        email,
        dept,
        role,
        user_type
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update member details
router.put("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, dept, role, user_type } = req.body;

    const { data, error } = await supabase
      .from("users")
      .update({
        name,
        email,
        dept,
        role,
        user_type
      })
      .eq("user_id", userId)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Member updated successfully",
      member: data[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all members list
router.get("/list", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email, dept, role, user_type")
      .order("name");

    if (error) return res.status(400).json({ error: error.message });

    res.json({ members: data });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;