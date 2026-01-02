const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

// Get all R&R entries for a user
router.get("/", auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    const { data: rnrEntries, error } = await supabase
      .from("rnr")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("R&R fetch error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(rnrEntries || []);

  } catch (error) {
    console.error("R&R error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new R&R entry
router.post("/", auth, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { rnr, description, end_goal, timings, guideline, process_limitations } = req.body;

    if (!rnr) {
      return res.status(400).json({ error: "rnr is required" });
    }

    const { data: rnrEntry, error } = await supabase
      .from("rnr")
      .insert({
        user_id,
        rnr,
        description,
        end_goal,
        timings,
        guideline,
        process_limitations
      })
      .select()
      .single();

    if (error) {
      console.error("R&R creation error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(rnrEntry);

  } catch (error) {
    console.error("R&R creation error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update an R&R entry
router.put("/:id", auth, async (req, res) => {
  try {
    const user_id = req.user.id;
    const rnr_id = req.params.id;
    const { rnr, description, end_goal, timings, guideline, process_limitations } = req.body;

    const { data: rnrEntry, error } = await supabase
      .from("rnr")
      .update({
        rnr,
        description,
        end_goal,
        timings,
        guideline,
        process_limitations
      })
      .eq("rnr_id", rnr_id)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      console.error("R&R update error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!rnrEntry) {
      return res.status(404).json({ error: "R&R entry not found" });
    }

    res.json(rnrEntry);

  } catch (error) {
    console.error("R&R update error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete an R&R entry
router.delete("/:id", auth, async (req, res) => {
  try {
    const user_id = req.user.id;
    const rnr_id = req.params.id;

    const { error } = await supabase
      .from("rnr")
      .delete()
      .eq("rnr_id", rnr_id)
      .eq("user_id", user_id);

    if (error) {
      console.error("R&R deletion error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "R&R entry deleted successfully" });

  } catch (error) {
    console.error("R&R deletion error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;