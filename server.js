const express = require("express");
const cors = require("cors");
const reportsDownloadRoutes = require("./modules/reportsdownload");


require("dotenv").config();
const app = express();

// Enable CORS for specific origins
app.use(cors({
  origin: ['https://wpr-maven.vercel.app', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());
app.use("/tasks", require("./modules/tasks"));
app.use("/subtasks", require("./modules/subtasks"));
app.use("/inputs", require("./modules/inputs"));
app.use("/meetings", require("./modules/meetings"));
app.use("/task_meetings", require("./modules/task_meetings"));
app.use("/task_history", require("./modules/task_history"));
app.use("/dashboard", require("./modules/dashboard"));
app.use("/role_overview", require("./modules/role_overview"));
app.use("/projection", require("./modules/projection"));


app.use("/hod/tasks", require("./modules/hod/hod-tasks"));
app.use("/hod/assign", require("./modules/hod/assign_tasks"));
app.use("/hod/meetings", require("./modules/hod/hod-meetings"));
app.use("/hod/dashboard", require("./modules/hod/hod-dashboard"));
app.use("/hod/weekly", require("./modules/hod/hod-weekly"));
app.use("/hod/reports", require("./modules/hod/hod-download"));
app.use("/hod/fixed-tasks", require("./modules/hod/hod-fixed-tasks"));
app.use("/hod/monthly-projection", require("./modules/hod/monthly_projection"));

app.use("/login", require("./modules/auth/login"));
app.use("/refresh", require("./modules/auth/refresh"));
app.use("/weekly", require("./modules/weekly"));
app.use("/reports", require("./modules/reportsdownload"));
app.use("/admin/members", require("./modules/admin/members"));
app.use("/admin/tasks", require("./modules/admin/admin-tasks"));
app.use("/admin/assign",require ("./modules/admin/admin-assign"))
app.use("/admin/meetings", require("./modules/admin/admin-meetings"));
app.use("/admin/weekly", require("./modules/admin/admin-weekly"));
app.use("/admin/rnr", require("./modules/admin/admin-rnr"));
app.use("/admin/individual-analytics", require("./modules/admin/admin-individual-analytics"));
app.use("/admin/dept-analytics", require("./modules/admin/dept-analytics"));
app.use("/sub-admin/users", require("./modules/sub-admin/sub-admin-users"));
app.use("/sub-admin/tasks", require("./modules/sub-admin/sub-admin-tasks"));
app.use("/sub-admin/meetings", require("./modules/sub-admin/sub-admin-meetings"));
app.use("/sub-admin/weekly", require("./modules/sub-admin/sub-admin-weekly"));
app.use("/sub-admin/analytics", require("./modules/sub-admin/sub-admin-analytics"));
app.use("/sub-admin/dashboard", require("./modules/sub-admin/sub-admin-dashboard"));
app.use("/update", require("./modules/sub-admin/sub-admin-assign-update"))
app.use("/assign", require("./modules/sub-admin/assign"));
app.use("/fixed-tasks", require("./modules/fixed-tasks"));
app.use("/rnr", require("./modules/rnr"));
app.get("/", (req, res) => {
  res.send("Server is running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port 5000`);
});
