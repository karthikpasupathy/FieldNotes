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

// Define path map for different apps
type AppType = "main" | "admin";

const getAppType = (): AppType => {
  if (window.location.pathname.startsWith('/admin')) {
    return "admin";
  }
  return "main";
};

// Render appropriate app based on path
const root = createRoot(document.getElementById("root")!);
const appType = getAppType();

// Use separate entry points for admin and main apps to avoid hook sharing issues
if (appType === "admin") {
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
