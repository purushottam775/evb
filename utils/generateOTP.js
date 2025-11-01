/**
 * Generate a numeric OTP
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} OTP
 */
export const generateOTP = (length = 6) => {
  if (length <= 0) throw new Error("OTP length must be greater than 0");

  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10);
  }

  // Ensure OTP is padded with zeros if needed
  return otp.padStart(length, "0");
};
