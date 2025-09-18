use evc;

-- USER TABLE
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(15),
    password VARCHAR(255) NOT NULL,
    vehicle_number VARCHAR(20) UNIQUE,
    vehicle_type VARCHAR(50)
);

-- ADMIN TABLE
CREATE TABLE Admin (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('super admin', 'station manager'))
);

-- CHARGING STATION TABLE
CREATE TABLE ChargingStation (
    station_id INT AUTO_INCREMENT PRIMARY KEY,
    station_name VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    total_slots INT NOT NULL,
    available_slots INT,
    charging_type VARCHAR(50) CHECK (charging_type IN ('fast', 'slow')),
    station_status VARCHAR(20) CHECK (station_status IN ('active', 'inactive'))
);

-- SLOT TABLE
CREATE TABLE Slot (
    slot_id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    slot_number INT NOT NULL,
    slot_status VARCHAR(20) CHECK (slot_status IN ('available', 'booked', 'maintenance')),
    CONSTRAINT fk_slot_station FOREIGN KEY (station_id) REFERENCES ChargingStation(station_id) ON DELETE CASCADE,
    UNIQUE(station_id, slot_number) -- prevent duplicate slot numbers in same station
);

-- BOOKING TABLE
CREATE TABLE Booking (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    slot_id INT NOT NULL,
    station_id INT NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    payment_status VARCHAR(20) CHECK (payment_status IN ('paid', 'unpaid')),
    booking_status VARCHAR(20) CHECK (booking_status IN ('active', 'completed', 'cancelled')),
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_slot FOREIGN KEY (slot_id) REFERENCES Slot(slot_id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_station FOREIGN KEY (station_id) REFERENCES ChargingStation(station_id) ON DELETE CASCADE
);

-- PAYMENT TABLE
CREATE TABLE Payment (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    payment_amount DECIMAL(10,2) NOT NULL,
    payment_mode VARCHAR(50) CHECK (payment_mode IN ('UPI', 'card', 'wallet')),
    payment_date DATE NOT NULL,
    payment_status VARCHAR(20) CHECK (payment_status IN ('paid', 'unpaid')),
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES Booking(booking_id) ON DELETE CASCADE
);
