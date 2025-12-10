const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// HOD weekly report (self or team)
router.post("/", async (req, res) => {
  try {
    const {
      user_id, // HOD user_id
      view_type, // "self" or "team"
      target_user_id, // for team view: the team member whose report to generate
      from_date,
      to_date,
      task_type,
      category, // "all", "self", "assigned"
      status
    } = req.body;

    // Determine whose report to generate
    const targetUserId = view_type === "self" ? user_id : target_user_id;

    if (view_type === "team" && !target_user_id) {
      return res.status(400).json({ error: "target_user_id required when viewing team reports" });
    }

    // Prepare responses
    let selfQuery = supabase.from("self_tasks").select("*");
    let masterQuery = supabase.from("master_tasks").select("*");

    // ---------------------- DATE FILTER ----------------------
    if (from_date && to_date) {
      selfQuery = selfQuery
        .gte("date", from_date)
        .lte("date", to_date);

      masterQuery = masterQuery
        .gte("date", from_date)
        .lte("date", to_date);
    }

    // ---------------------- STATUS FILTER ----------------------
    if (status && status !== "all") {
      selfQuery = selfQuery.eq("status", status);
      masterQuery = masterQuery.eq("status", status);
    }

    // ---------------------- CATEGORY FILTER (self/assigned/all) ----------------------
    if (category === "self") {
      selfQuery = selfQuery.eq("user_id", targetUserId);
      masterQuery = masterQuery.limit(0); // exclude assigned tasks
    } else if (category === "assigned") {
      masterQuery = masterQuery.eq("assigned_to", targetUserId);
      selfQuery = selfQuery.limit(0); // exclude self tasks
    } else {
      // category = "all" or undefined
      selfQuery = selfQuery.eq("user_id", targetUserId);
      masterQuery = masterQuery.eq("assigned_to", targetUserId);
    }

    // ---------------------- TASK TYPE FILTER (Fixed, Variable, etc.) ----------------------
    // Only applies to self_tasks since master_tasks don't have task_type
    if (task_type && task_type !== "all") {
      selfQuery = selfQuery.eq("task_type", task_type);
    }

    // ---------------------- EXECUTE BOTH QUERIES ----------------------
    const [selfRes, masterRes] = await Promise.all([
      selfQuery,
      masterQuery
    ]);

    if (selfRes.error || masterRes.error) {
      return res.status(400).json({
        error: selfRes.error?.message || masterRes.error?.message
      });
    }

    // Merge results
    const finalResponse = [
      ...selfRes.data.map(t => ({ ...t, source: "self" })),
      ...masterRes.data.map(t => ({ ...t, source: "assigned" }))
    ];

    res.json({
      tasks: finalResponse,
      report_for: targetUserId,
      view_type
    });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;