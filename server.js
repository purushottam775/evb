import express from "express";
import dotenv from "dotenv";
import cors from "cors";

// Import routes
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import stationRoutes from "./routes/stationRoutes.js"; // new
import slotRoutes from "./routes/slotRoutes.js"; // new
import bookingUserRoutes from "./routes/bookingUserRoutes.js";
import bookingAdminRoutes from "./routes/bookingAdminRoutes.js";



dotenv.config();
const app = express();


// Middleware
app.use(cors());
app.use(express.json());


// Root route
app.get("/", (req, res) => {
  res.send("EV Slot Management Backend is running!");
});


// Routes
app.use("/api/users", userRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/admins/users", adminUserRoutes);
app.use("/api/stations", stationRoutes); // stations management
app.use("/api/slots", slotRoutes);

// Booking routes
app.use("/api/bookings/user", bookingUserRoutes);   // user routes
app.use("/api/bookings/admin", bookingAdminRoutes); // admin routes




// Catch-all for invalid endpointsa
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

