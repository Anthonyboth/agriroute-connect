import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster />
    <Sonner />
  </>
);
