import { createRoot } from "react-dom/client";
import App from "./App";
import AdminApp from "./AdminApp";
import "./index.css";
import { ChevronLeft, ChevronRight, Calendar, List, Settings } from "lucide-react";
import { StrictMode } from "react";

// Define custom icons to be consistent with design reference
export const CustomIcons = {
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  Settings
};

// Determine whether to render the admin or main app based on URL
const isAdminPath = window.location.pathname.startsWith('/admin');

// Create separate roots for each app to prevent hook sharing issues
const root = createRoot(document.getElementById("root")!);

if (isAdminPath) {
  root.render(
    <StrictMode>
      <AdminApp />
    </StrictMode>
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
