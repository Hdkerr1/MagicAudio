import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Pricing from "./pages/Pricing";
import Library from "./pages/Library";
import Admin from "./pages/Admin";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import DMCAPolicy from "./pages/DMCAPolicy";
import RefundPolicy from "./pages/RefundPolicy";
import ContactUs from "./pages/ContactUs";
import ForgeMashup from "./pages/ForgeMashup";
import ForgeSpatial from "./pages/ForgeSpatial";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/library" element={<Library />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/dmca" element={<DMCAPolicy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Analytics />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
