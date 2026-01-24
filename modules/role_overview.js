const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

// GET role overview by user_id
router.get("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data, error } = await supabase
      .from("role_overview")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json({ role_overview: data });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST create new role overview
router.post("/", async (req, res) => {
  try {
    const {
      user_id,
      name,
      designation,
      subject,
      object,
      goal,
      reporting_person
    } = req.body;

    const { data, error } = await supabase
      .from("role_overview")
      .insert([
        {
          user_id,
          name,
          designation,
          subject,
          object,
          goal,
          reporting_person
        }
      ])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Role overview created successfully",
      role_overview: data[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// PUT update role overview by user_id
router.put("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const {
      name,
      designation,
      subject,
      object,
      goal,
      reporting_person
    } = req.body;

    const { data, error } = await supabase
      .from("role_overview")
      .update({
        name,
        designation,
        subject,
        object,
        goal,
        reporting_person
      })
      .eq("user_id", user_id)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Role overview updated successfully",
      role_overview: data[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;