/**
 * App.jsx
 * Root component — wraps everything in AuthProvider then AppRouter.
 * CSS imports are handled in main.jsx (theme → global → scanline).
 *
 * File location: frontend/src/App.jsx
 */

import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./routes/AppRouter";

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}