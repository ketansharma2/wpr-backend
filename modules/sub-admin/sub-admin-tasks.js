const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Get SubAdmin tasks - self tasks by default, master tasks when team member selected
router.post("/filter", auth, async (req, res) => {
  try {
    const {
      user_id,
      view_tasks_of = 'self',
      target_user_id,
      date_filter = 'all',
      task_type = 'all',
      status = 'all',
      category = 'all'
    } = req.body;

    // Build query for self tasks (SubAdmin's own tasks)
    let selfTasksQuery = supabase
      .from('self_tasks')
      .select(`
        *,
        users!self_tasks_user_id_fkey(name, email)
      `)
      .eq('user_id', user_id);

    // Build query for master tasks (tasks assigned to SubAdmin or by SubAdmin depending on context)
    let masterTasksQuery = supabase
      .from('master_tasks')
      .select('*');

    // Apply filters to both queries
    [selfTasksQuery, masterTasksQuery].forEach(query => {
      // Date filter
      if (date_filter !== 'all') {
        const today = new Date();
        let startDate, endDate;

        switch (date_filter) {
          case 'today':
            startDate = new Date(today);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = new Date(yesterday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(yesterday);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'past_week':
            endDate = new Date(today);
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'past_month':
            endDate = new Date(today);
            startDate = new Date(today);
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        }

        if (startDate && endDate) {
          query.gte('date', startDate.toISOString()).lte('date', endDate.toISOString());
        }
      }

      // Task type filter
      if (task_type !== 'all') {
        query.eq('task_type', task_type);
      }

      // Status filter
      if (status !== 'all') {
        query.eq('status', status);
      }
    });

    // Execute queries
    const [selfTasksResult, masterTasksResult] = await Promise.all([
      selfTasksQuery.order('date', { ascending: false }),
      masterTasksQuery.order('date', { ascending: false })
    ]);

    if (selfTasksResult.error) {
      console.error('Self tasks error:', selfTasksResult.error);
      return res.status(400).json({ error: selfTasksResult.error.message });
    }

    if (masterTasksResult.error) {
      console.error('Master tasks error:', masterTasksResult.error);
      return res.status(400).json({ error: masterTasksResult.error.message });
    }

    let filteredSelfTasks = selfTasksResult.data || [];
    let filteredMasterTasks = masterTasksResult.data || [];

    // Apply view filter
    if (view_tasks_of === 'all') {
      // Show all team members' self_tasks and ALL master_tasks (regardless of assigned_by)
      // Get all team member IDs (exclude Admin)
      const { data: teamMembersData } = await supabase
        .from('users')
        .select('user_id')
        .neq('user_type', 'Admin');

      const teamMemberIds = teamMembersData?.map(u => u.user_id) || [];

      if (teamMemberIds.length > 0) {
        // Fetch self_tasks for all team members
        let selfTasksQuery = supabase
          .from('self_tasks')
          .select(`
            *,
            users!self_tasks_user_id_fkey(name, email)
          `)
          .in('user_id', teamMemberIds);

        // Fetch ALL master_tasks (regardless of assigned_by)
        let masterTasksQuery = supabase
          .from('master_tasks')
          .select('*');

        // Apply category filter
        if (category === 'self') {
          masterTasksQuery = null; // Don't fetch master tasks
        } else if (category === 'assigned') {
          selfTasksQuery = null; // Don't fetch self tasks
        }
        // For 'all', fetch both

        let teamSelfTasks = [];
        let allMasterTasks = [];

        if (selfTasksQuery) {
          const { data } = await selfTasksQuery;
          teamSelfTasks = data || [];
        }

        if (masterTasksQuery) {
          const { data } = await masterTasksQuery;
          allMasterTasks = data || [];
        }

        filteredSelfTasks = teamSelfTasks;
        filteredMasterTasks = allMasterTasks;
      } else {
        filteredSelfTasks = [];
        filteredMasterTasks = [];
      }
    } else if (view_tasks_of === 'team' && target_user_id) {
      if (target_user_id === 'all') {
        // Show all team members' self_tasks and master_tasks
        // Get all team member IDs (exclude Admin and current SubAdmin)
        const { data: teamMembersData } = await supabase
          .from('users')
          .select('user_id')
          .neq('user_type', 'Admin')
          .neq('user_id', user_id);

        const teamMemberIds = teamMembersData?.map(u => u.user_id) || [];

        if (teamMemberIds.length > 0) {
          // Fetch self_tasks for all team members
          let selfTasksQuery = supabase
            .from('self_tasks')
            .select(`
              *,
              users!self_tasks_user_id_fkey(name, email)
            `)
            .in('user_id', teamMemberIds);

          // Fetch master_tasks assigned to team members
          let masterTasksQuery = supabase
            .from('master_tasks')
            .select('*')
            .in('assigned_to', teamMemberIds);

          // Apply category filter
          if (category === 'self') {
            masterTasksQuery = null;
          } else if (category === 'assigned') {
            selfTasksQuery = null;
          }

          let teamSelfTasks = [];
          let teamMasterTasks = [];

          if (selfTasksQuery) {
            const { data } = await selfTasksQuery;
            teamSelfTasks = data || [];
          }

          if (masterTasksQuery) {
            const { data } = await masterTasksQuery;
            teamMasterTasks = data || [];
          }

          filteredSelfTasks = teamSelfTasks;
          filteredMasterTasks = teamMasterTasks;
        } else {
          filteredSelfTasks = [];
          filteredMasterTasks = [];
        }
      } else {
        // Show specific user's self_tasks and master_tasks
        let userSelfTasks = [];
        let userMasterTasks = [];

        if (category !== 'assigned') {
          // Fetch the user's self_tasks
          const { data } = await supabase
            .from('self_tasks')
            .select(`
              *,
              users!self_tasks_user_id_fkey(name, email)
            `)
            .eq('user_id', target_user_id);
          userSelfTasks = data || [];
        }

        if (category !== 'self') {
          // Fetch master_tasks assigned to the user
          const { data } = await supabase
            .from('master_tasks')
            .select('*')
            .eq('assigned_to', target_user_id);
          userMasterTasks = data || [];
        }

        filteredSelfTasks = userSelfTasks;
        filteredMasterTasks = userMasterTasks;
      }
    } else {
      // Default: self view
      let selfTasks = [];
      let masterTasks = [];

      if (category === 'self') {
        // Only self tasks
        const { data } = await selfTasksQuery;
        selfTasks = data || [];
      } else if (category === 'assigned') {
        // Only master tasks assigned to this user
        masterTasksQuery = masterTasksQuery.eq('assigned_to', user_id);
        const { data } = await masterTasksQuery;
        masterTasks = data || [];
      } else {
        // All: self tasks and master tasks assigned to this user
        masterTasksQuery = masterTasksQuery.eq('assigned_to', user_id);
        const [selfResult, masterResult] = await Promise.all([
          selfTasksQuery,
          masterTasksQuery
        ]);
        selfTasks = selfResult.data || [];
        masterTasks = masterResult.data || [];
      }

      filteredSelfTasks = selfTasks;
      filteredMasterTasks = masterTasks;
    }

    // Get user details for master tasks
    const assignedToIds = [...new Set(filteredMasterTasks.map(task => task.assigned_to).filter(id => id))];
    const assignedByIds = [...new Set(filteredMasterTasks.map(task => task.assigned_by).filter(id => id))];

    let userDetails = {};
    if (assignedToIds.length > 0 || assignedByIds.length > 0) {
      const allUserIds = [...new Set([...assignedToIds, ...assignedByIds])];
      const { data: usersData } = await supabase
        .from('users')
        .select('user_id, name, email')
        .in('user_id', allUserIds);

      userDetails = usersData?.reduce((acc, user) => {
        acc[user.user_id] = user;
        return acc;
      }, {}) || {};
    }

    res.json({
      self_tasks: filteredSelfTasks.map(task => ({
        ...task,
        itemType: 'task',
        category: 'self',
        owner_name: task.users?.name,
        owner_email: task.users?.email
      })),
      master_tasks: filteredMasterTasks.map(task => ({
        ...task,
        itemType: 'task',
        category: 'assigned',
        assigned_by_user: userDetails[task.assigned_by] || { name: 'Unknown' },
        users: userDetails[task.assigned_to] || { name: 'Unknown' }
      }))
    });

  } catch (err) {
    console.error('SubAdmin tasks filter error:', err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;