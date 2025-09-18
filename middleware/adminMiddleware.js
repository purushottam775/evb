import db from "../config/db.js";
import { verifyToken } from "../utils/token.js";

export const adminProtect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: "Not authorized or token expired" });
    }

    // Ensure your DB column matches the token payload
    db.query(
      "SELECT admin_id AS id, name, email, role FROM Admin WHERE admin_id = ?",
      [decoded.id],
      (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length === 0) return res.status(404).json({ message: "Admin not found" });

        req.admin = results[0];
        next();
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
