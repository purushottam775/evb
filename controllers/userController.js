import bcrypt from "bcryptjs";
import db from "../config/db.js";
import { generateToken } from "../utils/token.js";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import { generateOTP } from "../utils/generateOTP.js";
import { otpTemplate } from "../utils/emailTemplates.js";


// Helper function to run MySQL queries with Promises
const query = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

// ---------------- Register User ----------------
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone_number, vehicle_number, vehicle_type } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: "Invalid email format." });

    // Password length validation
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

    // Check if user exists
    const [existing] = await query("SELECT * FROM User WHERE email = ?", [email]);
    if (existing) return res.status(400).json({ message: "User already exists." });

    // Check if vehicle number already exists (if provided)
    if (vehicle_number) {
      const [existingVehicle] = await query("SELECT * FROM User WHERE vehicle_number = ?", [vehicle_number]);
      if (existingVehicle) return res.status(400).json({ message: "Vehicle number already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    await query(
      `INSERT INTO User(name, email, phone_number, password, vehicle_number, vehicle_type, is_verified, verification_token) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone_number || null, hashedPassword, vehicle_number || null, vehicle_type || null, false, verificationToken]
    );

    // Verification link points to backend route
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const verifyLink = `${backendUrl}/api/users/verify/${verificationToken}`;

    await sendEmail(
      email,
      "Verify your account",
      `<h2>Welcome, ${name}!</h2>
       <p>Please click the link below to verify your account:</p>
       <a href="${verifyLink}" target="_blank">${verifyLink}</a>
       <p>If you did not register, please ignore this email.</p>`
    );

    res.status(201).json({ message: "Registration successful. Check your email to verify your account." });
  } catch (err) {
    console.error("Register error:", err);
    
    // Handle specific database errors
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.sqlMessage.includes('vehicle_number')) {
        return res.status(400).json({ message: "Vehicle number already registered." });
      } else if (err.sqlMessage.includes('email')) {
        return res.status(400).json({ message: "Email already registered." });
      } else {
        return res.status(400).json({ message: "Duplicate entry. Please check your information." });
      }
    }
    
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// verify User

export const verifyUser = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).send("<h2>Verification token is required.</h2>");
    }

    const [user] = await query("SELECT * FROM User WHERE verification_token = ?", [token]);
    if (!user) {
      return res.status(400).send("<h2>Invalid or expired verification token.</h2>");
    }

    await query("UPDATE User SET is_verified = 1, verification_token = NULL WHERE user_id = ?", [user.user_id]);

    // Send HTML message to browser
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.send(`
      <div style="text-align:center; margin-top:50px;">
        <h1 style="color:green;"> Your account has been verified!</h1>
        <p>You can now <a href="${clientUrl}/login">login</a>.</p>
      </div>
    `);
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).send("<h2>Server error. Please try again later.</h2>");
  }
};



// ---------------- Login User ----------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Fetch user
    const users = await query("SELECT * FROM User WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];

     // check if user is blocked
    if (user.is_blocked) {
      return res.status(403).json({ message: "Your account is blocked. Contact admin." });
    }

    // Check if user is verified
    if (!user.is_verified) {
      return res.status(403).json({ message: "Please verify your email before logging in." });
    }



    if (!user.password) {
      return res.status(500).json({ message: "User password not set in database" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken({ id: user.user_id, role: user.role || "user" });

    // Remove password before sending response
    const { password: _, ...safeUser } = user;

    res.json({
      message: "Login successful",
      token,
      user: safeUser
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
       //     forget password 

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if email is provided
    if (!email) return res.status(400).json({ message: "Email is required." });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: "Invalid email format." });

    // Check if user exists
    const [user] = await query("SELECT * FROM User WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Check if user is blocked
    if (user.is_blocked) return res.status(403).json({ message: "Your account is blocked. Contact admin." });

    // Generate OTP and expiry
    const otp = generateOTP(6);
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Store OTP and expiry in DB
    await query("UPDATE User SET otp_code = ?, otp_expiry = ? WHERE email = ?", [otp, expiry, email]);

    // Send OTP via email
    await sendEmail(email, "Password Reset OTP", otpTemplate(user.name, otp));

    res.json({ message: "OTP sent to your email. It is valid for 10 minutes." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

            //  reset password  

export const resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validate required fields
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required." });
    }

    // Optional: validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // Optional: validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    // Fetch user
    const [user] = await query("SELECT * FROM User WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Check if user is blocked
    if (user.is_blocked) return res.status(403).json({ message: "Your account is blocked. Contact admin." });

    // Validate OTP
    if (user.otp_code !== otp) return res.status(400).json({ message: "Invalid OTP." });
    if (new Date() > user.otp_expiry) return res.status(400).json({ message: "OTP has expired. Please request a new one." });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    await query(
      "UPDATE User SET password = ?, otp_code = NULL, otp_expiry = NULL WHERE user_id = ?",
      [hashedPassword, user.user_id]
    );

    // Send confirmation email
    await sendEmail(
      email,
      "Password Reset Successful",
      `<h2>Hello ${user.name},</h2>
       <p>Your password has been successfully reset. If you did not perform this action, please contact support immediately.</p>`
    );

    res.json({ message: "Password reset successfully. Confirmation email sent." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

//---------------- Get Profile ----------------
export const getProfile = async (req, res) => {
  try {
    res.json({ message: "User profile fetched successfully", user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


   // ---------------- Update Profile ----------------
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { name, phone_number, vehicle_number, vehicle_type } = req.body;

    const updates = [];
    const params = [];

    if (name) { updates.push("name = ?"); params.push(name); }
    if (phone_number) { updates.push("phone_number = ?"); params.push(phone_number); }
    if (vehicle_number) { updates.push("vehicle_number = ?"); params.push(vehicle_number); }
    if (vehicle_type) { updates.push("vehicle_type = ?"); params.push(vehicle_type); }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields provided to update" });
    }

    params.push(userId);

    const sql = `UPDATE User SET ${updates.join(", ")} WHERE user_id = ?`;
    await query(sql, params);

    const [updatedUser] = await query(
      "SELECT user_id, name, email, phone_number, vehicle_number, vehicle_type, role, is_blocked FROM User WHERE user_id = ?",
      [userId]
    );

    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Get User Stats ----------------
export const getUserStats = async (req, res) => {
  try {
    const { user_id } = req.params;
    const userId = req.user.user_id;

    // Ensure user can only access their own stats
    if (Number(user_id) !== Number(userId)) {
      return res.status(403).json({ message: "Not authorized to access this user's stats" });
    }

    // Get total bookings count
    const totalResults = await query(
      "SELECT COUNT(*) as total FROM bookings WHERE user_id = ?",
      [userId]
    );
    const total_bookings = Number(totalResults[0]?.total) || 0;

    // Get counts by status
    const approvedResults = await query(
      "SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND booking_status = 'approved'",
      [userId]
    );
    const approved = Number(approvedResults[0]?.count) || 0;

    const pendingResults = await query(
      "SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND booking_status = 'pending'",
      [userId]
    );
    const pending = Number(pendingResults[0]?.count) || 0;

    const rejectedResults = await query(
      "SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND booking_status = 'rejected'",
      [userId]
    );
    const rejected = Number(rejectedResults[0]?.count) || 0;

    const cancelledResults = await query(
      "SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND booking_status = 'cancelled'",
      [userId]
    );
    const cancelled = Number(cancelledResults[0]?.count) || 0;

    res.json({
      message: "User booking stats fetched",
      stats: {
        total_bookings,
        approved,
        pending,
        rejected,
        cancelled
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

  