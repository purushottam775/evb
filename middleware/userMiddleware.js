import db from "../config/db.js";
import { verifyToken } from "../utils/token.js";

export const userProtect = (req, res, next) => {
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

    // Fetch user from DB
    db.query(
      "SELECT user_id, name, email, phone_number, vehicle_number, vehicle_type FROM User WHERE user_id = ?",
      [decoded.id],
      (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length === 0) return res.status(404).json({ message: "User not found" });

        req.user = results[0];
        next();
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
