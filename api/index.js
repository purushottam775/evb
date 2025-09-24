// api/index.js
import app from "../server.js";

// Vercel serverless function
export default async (req, res) => {
  await app(req, res);
};