const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// HOD weekly report (self, team, or all)
router.post("/", async (req, res) => {
  try {
    const {
      user_id, // HOD user_id
      view_type, // "self", "team", or "all"
      target_user_id, // for team view: the team member whose report to generate
      from_date,
      to_date,
      task_type,
      category, // "all", "self", "assigned"
      status
    } = req.body;

    // Determine whose report to generate
    let targetUserIds = [];
    if (view_type === 'all') {
      // Get all team members in the department
      const { data: hodData, error: hodError } = await supabase
        .from("users")
        .select("dept")
        .eq("user_id", user_id)
        .single();

      if (hodError) {
        console.error("HOD data error:", hodError);
        return res.status(400).json({ error: hodError.message });
      }

      const { data: teamMembers, error: teamError } = await supabase
        .from("users")
        .select("user_id")
        .eq("dept", hodData.dept);

      if (teamError) {
        console.error("Team members error:", teamError);
        return res.status(400).json({ error: teamError.message });
      }

      targetUserIds = teamMembers.map(member => member.user_id);
    } else {
      targetUserIds = [view_type === "self" ? user_id : target_user_id];
    }

    if (view_type === "team" && !target_user_id) {
      return res.status(400).json({ error: "target_user_id required when viewing team reports" });
    }

    // Prepare responses with user joins
    let selfQuery = supabase.from("self_tasks").select("*, users(name)");
    let masterQuery = supabase.from("master_tasks").select("*, assigned_by_user:users!assigned_by(name), assigned_to_user:users!assigned_to(name)");

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
      selfQuery = targetUserIds.length === 1
        ? selfQuery.eq("user_id", targetUserIds[0])
        : selfQuery.in("user_id", targetUserIds);
      masterQuery = masterQuery.limit(0); // exclude assigned tasks
    } else if (category === "assigned") {
      masterQuery = targetUserIds.length === 1
        ? masterQuery.eq("assigned_to", targetUserIds[0])
        : masterQuery.in("assigned_to", targetUserIds);
      selfQuery = selfQuery.limit(0); // exclude self tasks
    } else {
      // category = "all" or undefined
      selfQuery = targetUserIds.length === 1
        ? selfQuery.eq("user_id", targetUserIds[0])
        : selfQuery.in("user_id", targetUserIds);
      masterQuery = targetUserIds.length === 1
        ? masterQuery.eq("assigned_to", targetUserIds[0])
        : masterQuery.in("assigned_to", targetUserIds);
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
      report_for: targetUserIds,
      view_type
    });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;