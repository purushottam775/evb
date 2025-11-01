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


app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174', 
    'http://127.0.0.1:5173', 
    'http://127.0.0.1:5174',
    'https://evf-2gfa.vercel.app',  // Vercel production URL
    /\.vercel\.app$/,  // All Vercel preview and production URLs
    /^https:\/\/evf-.*\.vercel\.app$/  // All Vercel deployments for this project
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());


// Root route
app.get("/", (req, res) => {
  res.send("EV Slot Management Backend is running");
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
app.listen(PORT, '0.0.0.0', () => {  
  console.log(`Server running on port ${PORT}`);
});
