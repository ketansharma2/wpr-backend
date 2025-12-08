const express = require("express");
const PDFDocument = require("pdfkit");
const supabase = require("../config/supabase");

const router = express.Router();

// -------- DOWNLOAD WEEKLY REPORT PDF ----------
router.post("/download", async (req, res) => {
  try {
    const {
      user_id,
      start_date,
      end_date,
      task_type,
      category,
      status
    } = req.body;

    // ---------------------- VALIDATION -----------------------
    if (!user_id || !start_date || !end_date) {
      return res.status(400).json({ error: "user_id, start_date, end_date are required" });
    }

    // ---------------------- QUERY FUNCTION -------------------
    const applyFilters = (table) => {
      let q;

      if (table === "self_tasks") {
        q = supabase.from(table).select("*").eq("user_id", user_id);
      } else {
        q = supabase.from(table).select("*").eq("assigned_to", user_id);
      }

      q = q.gte("date", start_date).lte("date", end_date);

      // Task type filter only applies to self_tasks (master_tasks don't have task_type)
      if (table === "self_tasks" && task_type && task_type !== "all") q = q.eq("task_type", task_type);
      if (category && category !== "all") q = q.eq("category", category);
      if (status && status !== "all") q = q.eq("status", status);

      return q;
    };

    // ---------------------- FETCH DATA -----------------------
    const [selfRes, masterRes] = await Promise.all([
      applyFilters("self_tasks"),
      applyFilters("master_tasks")
    ]);

    const selfTasks = selfRes.data || [];
    const masterTasks = masterRes.data || [];

    // ---------------------- PDF CREATION ---------------------
    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=weekly_report.pdf"
    );

    doc.pipe(res);

    // ---------------------- TITLE ---------------------------
    doc
      .fontSize(20)
      .text("Weekly Work Report", { align: "center" })
      .moveDown();

    doc.fontSize(12).text(`User ID: ${user_id}`);
    doc.text(`Report Duration: ${start_date} to ${end_date}`);
    doc.text(`Status Filter: ${status || "all"}`);
    doc.text(`Category Filter: ${category || "all"}`);
    doc.text(`Task Type Filter: ${task_type || "all"}`);
    doc.moveDown(2);

    // ---------------------- SELF TASKS -----------------------
    doc.fontSize(16).text("Self Tasks", { underline: true }).moveDown(0.5);

    if (selfTasks.length === 0) {
      doc.fontSize(12).text("No self tasks found.").moveDown();
    } else {
      selfTasks.forEach((task, i) => {
        doc.fontSize(12).text(`${i + 1}. ${task.task_name}`);
        doc.text(`   Date: ${task.date}`);
        doc.text(`   Status: ${task.status}`);
        doc.text(`   Type: ${task.task_type}`);
        doc.text(`   Time: ${task.time} mins`);
        doc.moveDown();
      });
    }

    doc.addPage();

    // ---------------------- MASTER TASKS -------------------------
    doc.fontSize(16).text("Assigned Tasks (Master Tasks)", { underline: true }).moveDown(0.5);

    if (masterTasks.length === 0) {
      doc.fontSize(12).text("No assigned tasks found.").moveDown();
    } else {
      masterTasks.forEach((task, i) => {
        doc.fontSize(12).text(`${i + 1}. ${task.task_name}`);
        doc.text(`   Date: ${task.date}`);
        doc.text(`   Assigned By: ${task.assigned_by}`);
        doc.text(`   Status: ${task.status}`);
        doc.text(`   Type: ${task.task_type}`);
        doc.moveDown();
      });
    }

    doc.end();

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server Error in generating PDF" });
  }
});

module.exports = router;
