import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ChevronLeft, ChevronRight, Calendar, List, Settings } from "lucide-react";

// Define custom icons to be consistent with design reference
export const CustomIcons = {
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  Settings
};

createRoot(document.getElementById("root")!).render(<App />);
