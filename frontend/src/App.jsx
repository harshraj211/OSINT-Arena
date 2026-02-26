/**
 * App.jsx
 * Root component — wraps everything in AuthProvider.
 *
 * File location: frontend/src/App.jsx
 */

import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./routes/AppRouter";
import "./styles/global.css";
import "./styles/theme.css";
import "./styles/scanline.css";

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}