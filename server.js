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

app.use("/login", require("./modules/login"));
app.use("/weekly", require("./modules/weekly"));
app.use("/reports", require("./modules/reportsdownload"));

app.get("/", (req, res) => {
  res.send("Server is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port 3000`);
});
