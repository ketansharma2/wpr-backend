const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// Filter HOD meetings (self or team)
router.post("/filter", async (req, res) => {
  try {
    console.log('HOD meetings filter request received:', req.body);
    const {
      user_id, // HOD user_id
      view_type, // "self" or "team"
      target_user_id, // for team  view: the team member whose meetings to view
      date_filter,
      status,
      custom_date
    } = req.body;

    // Determine whose meetings to view
    let targetUserIds = [];
    if (view_type === "all") {
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
      return res.status(400).json({ error: "target_user_id required when viewing team meetings" });
    }

    const format = (d) => new Date(d).toISOString().split("T")[0];

    let today = new Date();
    let formattedToday = format(today);

    let startDate = null;
    let endDate = null;

    // ---------- DATE FILTERS ----------

    if (date_filter === "today") {
      startDate = endDate = formattedToday;
    }

    if (date_filter === "yesterday") {
      let d = new Date();
      d.setDate(d.getDate() - 1);
      startDate = endDate = format(d);
    }

    if (date_filter === "custom") {
      startDate = endDate = custom_date;
    }

    if (date_filter === "past_week") {
      let d = new Date();
      d.setDate(d.getDate() - 7);

      let day = d.getDay();

      let monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));

      let saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);

      startDate = format(monday);
      endDate = format(saturday);
    }

    if (date_filter === "past_month") {
      let now = new Date();
      let first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      let last = new Date(now.getFullYear(), now.getMonth(), 0);

      startDate = format(first);
      endDate = format(last);
    }

    // ---------- BUILD QUERY ----------
    let query = supabase.from("meetings").select(`
      *,
      users(name)
    `);
    if (view_type === "all") {
      query = query.in("user_id", targetUserIds);
    } else {
      query = query.eq("user_id", targetUserIds[0]);
    }

    if (startDate && endDate) {
      query = query.gte("date", startDate).lte("date", endDate);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    // Add owner_name to meetings for 'all' view
    const meetingsWithOwner = data.map(meeting => ({
      ...meeting,
      owner_name: meeting.users?.name || 'Unknown'
    }));

    res.json({ meetings: meetingsWithOwner, view_type });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// Get team members for meeting viewing dropdown (excluding current HOD)
router.get("/team-members/:department/:exclude_user_id", async (req, res) => {
  try {
    const { department, exclude_user_id } = req.params;

    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email")
      .eq("dept", department)
      .neq("user_id", exclude_user_id);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ team_members: data });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Create department meeting
router.post("/create", async (req, res) => {
  try {
    console.log('meeting create request:', req.body);
    const {
      user_id, // HOD user_id
      meeting_name,
      date,
      dept,
      co_person,
      time,
      prop_slot,
      status,
      notes
    } = req.body;

    const { data, error } = await supabase
      .from("meetings")
      .insert([
        {
          user_id,
          meeting_name,
          date,
          dept,
          co_person,
          time,
          prop_slot,
          status,
          notes
        }
      ])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "meeting created successfully",
      meeting: data[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update department meeting
router.put("/:meeting_id", async (req, res) => {
  try {
    const { meeting_id } = req.params;
    console.log('Received department meeting update request:', req.body);

    const {
      user_id,
      meeting_name,
      date,
      dept,
      co_person,
      time,
      prop_slot,
      status,
      notes
    } = req.body;

    const { data, error } = await supabase
      .from("meetings")
      .update({
        user_id,
        meeting_name,
        date,
        dept,
        co_person,
        time,
        prop_slot,
        status,
        notes
      })
      .eq("meeting_id", meeting_id)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Department meeting updated successfully",
      meeting: data[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;