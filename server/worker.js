import { Worker } from "bullmq";

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    console.log("Job:", job.data);
  },
  { concurrency: 100 },
);

// Start the worker
// worker runs automatically when created
// but this is to ensure it starts processing jobs.
worker.run();
