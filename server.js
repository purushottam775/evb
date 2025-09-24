// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

// Import routes
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import stationRoutes from "./routes/stationRoutes.js";
import slotRoutes from "./routes/slotRoutes.js";
import bookingUserRoutes from "./routes/bookingUserRoutes.js";
import bookingAdminRoutes from "./routes/bookingAdminRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("EV Slot Management Backend is running!");
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/admins/users", adminUserRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/bookings/user", bookingUserRoutes);
app.use("/api/bookings/admin", bookingAdminRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// ✅ Export app — DO NOT call app.listen()
export default app;