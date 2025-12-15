const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

/**
 * 1️⃣ ASSIGNEE → REQUEST DEADLINE CHANGE
 * status = pending
 */
router.post("/request", async (req, res) => {
  try {
    const { task_id, new_deadline, reason } = req.body;
    const user_id = req.user.id;

    if (!task_id || !new_deadline || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { data: task, error } = await supabase
      .from("master_tasks")
      .select("timeline, assigned_by")
      .eq("taskid", task_id)
      .single();

    if (error || !task) {
      return res.status(404).json({ message: "Task not found" });
    }

    await supabase.from("task_deadline_requests").insert({
      task_id,
      requested_by: user_id,
      requested_deadline: new_deadline,
      reason,
      status: "pending"
    });

    await supabase.from("task_deadline_history").insert({
      task_type: "master",
      task_id,
      old_deadline: task.timeline,
      new_deadline,
      action: "requested",
      reason,
      changed_by: user_id
    });

    return res.status(200).json({
      message: "Deadline revision request sent"
    });

  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
});

/**
 * 2️⃣ ASSIGNED BY / HOD → APPROVE OR REJECT
 */
router.post("/review", async (req, res) => {
  try {
    const { request_id, decision } = req.body;
    const reviewer_id = req.user.id;

    if (!request_id || !["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const { data: request, error } = await supabase
      .from("task_deadline_requests")
      .select(`
        id,
        task_id,
        requested_deadline,
        status,
        master_tasks (
          timeline,
          assigned_by
        )
      `)
      .eq("id", request_id)
      .single();

    if (error || !request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already reviewed" });
    }

    if (request.master_tasks.assigned_by !== reviewer_id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (decision === "approved") {
      await supabase
        .from("master_tasks")
        .update({ timeline: request.requested_deadline })
        .eq("taskid", request.task_id);
    }

    await supabase
      .from("task_deadline_requests")
      .update({
        status: decision,
        reviewed_by: reviewer_id,
        reviewed_at: new Date()
      })
      .eq("id", request_id);

    await supabase.from("task_deadline_history").insert({
      task_type: "master",
      task_id: request.task_id,
      old_deadline: request.master_tasks.timeline,
      new_deadline: request.requested_deadline,
      action: decision,
      changed_by: reviewer_id
    });

    return res.status(200).json({
      message: `Request ${decision}`
    });

  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
});


// VIEW DEADLINE CHANGE HISTORY
router.get("/:task_id", async (req, res) => {
  try {
    const { task_id } = req.params;
    const user_id = req.user.id;

    const { data: task, error: taskError } = await supabase
      .from("master_tasks")
      .select("assigned_by")
      .eq("taskid", task_id)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.assigned_by !== user_id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { data, error } = await supabase
      .from("task_deadline_history")
      .select(`
        id,
        old_deadline,
        new_deadline,
        action,
        reason,
        changed_at,
        changed_by
      `)
      .eq("task_type", "master")
      .eq("task_id", task_id)
      .order("changed_at", { ascending: true });

    if (error) {
      return res.status(500).json({ message: "Failed to fetch history" });
    }

    return res.status(200).json({
      task_id,
      history: data
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


module.exports = router;
