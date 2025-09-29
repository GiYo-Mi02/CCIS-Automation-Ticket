require("dotenv").config();
const { runBatchWorker } = require("../lib/emailWorker");

runBatchWorker().catch((err) => {
  console.error("Email worker crashed", err);
  process.exit(1);
});
