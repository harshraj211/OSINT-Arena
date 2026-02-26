/**
 * main.jsx
 * Vite entry point for OSINT Arena frontend.
 *
 * Import order matters:
 *  1. theme.css  — CSS variables (must be first)
 *  2. global.css — resets + base styles
 *  3. scanline.css — CRT overlay (optional aesthetic)
 *  4. App        — React tree
 *
 * File location: frontend/src/main.jsx
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import "./styles/global.css";
import "./styles/scanline.css";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);