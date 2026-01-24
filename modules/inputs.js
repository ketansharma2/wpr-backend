const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

router.use(auth);

// Get all inputs for a specific task
router.get("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({ error: "Task ID is required" });
    }

    // Fetch inputs from inputs table
    const { data: inputs, error } = await supabase
      .from("inputs")
      .select("*")
      .eq("task_id", taskId)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching inputs:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: "Inputs fetched successfully",
      inputs: inputs || []
    });

  } catch (err) {
    console.error("Server error fetching inputs:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new input
router.post("/", async (req, res) => {
  try {
    const {
      task_id,
      deadline,
      date,
      input,
      input_by,
      impact_of_changes
    } = req.body;

    if (!task_id || !input) {
      return res.status(400).json({ error: "task_id and input are required" });
    }

    const { data: newInput, error } = await supabase
      .from("inputs")
      .insert([
        {
          task_id,
          deadline,
          date,
          input,
          input_by,
          impact_of_changes: impact_of_changes || ''
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating input:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: "Input created successfully",
      input: newInput
    });

  } catch (err) {
    console.error("Server error creating input:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update an input
router.put("/:inputId", async (req, res) => {
  try {
    const { inputId } = req.params;
    const {
      date,
      input,
      input_by,
      impact_of_changes
    } = req.body;

    const { data: updatedInput, error } = await supabase
      .from("inputs")
      .update({
        date,
        input,
        input_by,
        impact_of_changes
      })
      .eq("input_id", inputId)
      .select()
      .single();

    if (error) {
      console.error("Error updating input:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!updatedInput) {
      return res.status(404).json({ error: "Input not found" });
    }

    res.json({
      message: "Input updated successfully",
      input: updatedInput
    });

  } catch (err) {
    console.error("Server error updating input:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;