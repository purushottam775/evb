import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import db from "../config/db.js"; // your SQL connection

dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req, res) => {
  try {
    const { token } = req.body; // ID token from frontend
    if (!token) return res.status(400).json({ message: "Token is required" });

    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload(); // user info from Google
    const { sub: googleId, email, name } = payload;

    // Check if user exists in SQL
    const [existingUser] = await db.execute(
      "SELECT * FROM User WHERE email = ?",
      [email]
    );

    let user;
    if (existingUser.length === 0) {
      // Create new Google user
      const [result] = await db.execute(
        "INSERT INTO users (name, email, google_id, is_verified, role) VALUES (?, ?, ?, ?, ?)",
        [name, email, googleId, 1, "user"]
      );
      user = { id: result.insertId, name, email, role: "user", isBlocked: 0 };
    } else {
      user = existingUser[0];

      // Link Google ID if not linked
      if (!user.google_id) {
        await db.execute(
          "UPDATE users SET google_id = ?, is_verified = 1 WHERE id = ?",
          [googleId, user.id]
        );
      }
    }

    // Check if blocked
    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account is blocked. Contact admin." });
    }

    // Generate JWT
    const appToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token: appToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked
      },
      message: "Google login successful",
    });

  } catch (err) {
    console.error("Google OAuth error:", err);
    res.status(500).json({ message: "Google login failed", error: err.message });
  }
};
