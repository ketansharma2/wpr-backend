const express = require("express");
const cors = require("cors");
const reportsDownloadRoutes = require("./modules/reportsdownload");


require("dotenv").config();
const app = express();

// Enable CORS for all routes
app.use(cors());

app.use(express.json());
app.use("/tasks", require("./modules/tasks"));
app.use("/meetings", require("./modules/meetings"));
app.use("/dashboard", require("./modules/dashboard"));


app.use("/hod/tasks", require("./modules/hod/hod-tasks"));
app.use("/hod/assign", require("./modules/hod/assign_tasks"));
app.use("/hod/meetings", require("./modules/hod/hod-meetings"));
app.use("/hod/dashboard", require("./modules/hod/hod-dashboard"));
app.use("/hod/weekly", require("./modules/hod/hod-weekly"));
app.use("/hod/reports", require("./modules/hod/hod-download"));

app.use("/login", require("./modules/auth/login"));
app.use("/weekly", require("./modules/weekly"));
app.use("/reports", require("./modules/reportsdownload"));
app.use("/admin/members", require("./modules/admin/members"));
app.use("/admin/tasks", require("./modules/admin/admin-tasks"));
app.use("/admin/assign",require ("./modules/admin/admin-assign"))
app.use("/admin/meetings", require("./modules/admin/admin-meetings"));
app.use("/admin/weekly", require("./modules/admin/admin-weekly"));
app.use("/admin/individual-analytics", require("./modules/admin/admin-individual-analytics"));
app.use("/admin/dept-analytics", require("./modules/admin/dept-analytics"));
app.get("/", (req, res) => {
  res.send("Server is running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port 5000`);
});
