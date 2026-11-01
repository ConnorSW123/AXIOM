# AXIOM — Smart Bike Security & Telemetry System

> **Hidden in Design, Strong in Defence.**

Welcome to **AXIOM**!

AXIOM is an internally integrated electronic wheel-locking system and smart security app designed for premium e-bikes and urban micro-mobility fleets. Instead of relying on heavy external chains or bulky locks that are easy targets for power tools, AXIOM locks your bike mechanically from **inside** the frame tubing. If someone tries to force it, they cannot bypass the mechanism without destroying the frame itself!

---

## Features We Built

- **Internal Mechanical Deadbolt**: Concealed solenoid mechanism mechanically locks wheel rotation from inside the bike frame.
- **Keyless Proximity Unlock**: Simply walk up to your bike! Disarms automatically via Bluetooth Low Energy (BLE) proximity or encrypted RFID/NFC tag handshakes.
- **Real-Time Security & Tamper Alerts**: On-board accelerometer monitors frame strain and vibration, instantly alerting your phone and triggering a high-decibel siren if someone tampers with your ride.
- **Interactive Campus Map & Geofence**: High-precision GNSS tracking paired with adjustable geofence tolerance buffers (centered at the University of Glasgow campus) to absorb coordinate drift and prevent false alarms.
- **Ride Telemetry & Health Analytics**: Track your daily commutes, average speed, distance, calories burned, and total CO₂ saved.
- **Emergency Lost Mode**: Broadcasts emergency tracking signals across local mesh nodes for fast asset recovery.

---

## System Architecture & Workflow

1. **User Interface Layer**: The companion React app displays live telemetry, controls deadbolt actuation, and manages security settings via a responsive Leaflet interactive map.
2. **Encrypted Communication**: Secure handshakes occur over Bluetooth Low Energy (BLE) or encrypted AES-256 RFID/NFC tags when the smartphone enters proximity range.
3. **Firmware Controller**: The central MCU receives disarm signals, reads accelerometer data, and manages system power state.
4. **Hardware Actuation & Sensors**:
   - Internal deadbolt solenoid extends or retracts to lock wheel rotation.
   - On-board accelerometer monitors structural frame vibration to detect angle-grinder tampering.
   - GNSS receiver broadcasts live location coordinates and syncs with mesh nodes.

---

## Tech Stack

- **Frontend & App UI**: React, Tailwind CSS, Lucide React Icons
- **Interactive Mapping**: Leaflet.js, OpenStreetMap
- **State & Local Persistence**: Custom React Hooks & LocalStorage
- **Hardware & Firmware Interfacing**: Central MCU Firmware, Bluetooth Low Energy (BLE), AES-256 Encrypted RFID, Gyroscope/Accelerometer telemetry

---

## Project Structure

- `public/Logo.png` — Official AXIOM Brand Mark
- `src/App.jsx` — Main Dashboard & Interactive Map App
- `src/main.jsx` — React Entry Point
- `src/index.css` — Global Styles & Tailwind Directives
- `src/App.css` — Leaflet Canvas & Custom Overrides
- `package.json` — Project Dependencies & Scripts
- `vite.config.js` — Vite Configuration
- `README.md` — Project Overview & Documentation

---

## Getting Started

Want to run AXIOM locally on your machine? Follow these simple steps:

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your computer.

### 2. Setup & Run

Clone the repository and install the dependencies:

```bash
# Clone the repository
git clone [https://github.com/YOUR-USERNAME/axiom.git](https://github.com/YOUR-USERNAME/axiom.git)

# Move into the project directory
cd axiom

# Install project dependencies
npm install

# Start the local development server
npm run dev
