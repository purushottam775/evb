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
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173', 
      'http://localhost:5174', 
      'http://127.0.0.1:5173', 
      'http://127.0.0.1:5174',
      'https://evf-2gfa.vercel.app',  // Vercel production URL
      'https://evf-cr9t.vercel.app',  // Vercel preview URL
    ];
    
    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check if it's a Vercel app URL (any evf-*.vercel.app)
    if (/^https:\/\/evf-[\w-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    
    // Fallback: allow all Vercel preview URLs (for any project)
    if (/\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
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




// Catch-all for invalid endpoints
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

