import jwt from "jsonwebtoken";

// Generate JWT
export const generateToken = (payload) => {
  const secret = process.env.JWT_SECRET || 'default_jwt_secret_key_for_development';
  return jwt.sign(payload, secret, { expiresIn: "30d" });
};

// Verify JWT
export const verifyToken = (token) => {
  try {
    const secret = process.env.JWT_SECRET || 'default_jwt_secret_key_for_development';
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
};
