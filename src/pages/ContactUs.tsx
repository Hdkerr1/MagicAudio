import { useNavigate, Link } from 'react-router-dom';
import { Mail, MessageSquare, Shield, CreditCard, Clock } from 'lucide-react';

const ContactUs = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
        <p className="text-muted-foreground text-sm mb-8">We're here to help. Choose the right channel for your inquiry below.</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <Mail className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-foreground font-semibold mb-1">General Support</h3>
              <p className="mb-3">For technical issues, feature requests, account assistance, or general inquiries.</p>
              <a href="mailto:support@tunesence.com" className="text-primary hover:underline font-medium">
                support@tunesence.com
              </a>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <CreditCard className="w-6 h-6 text-accent mb-3" />
              <h3 className="text-foreground font-semibold mb-1">Billing & Payments</h3>
              <p className="mb-3">For subscription issues, payment failures, refund requests, or invoice inquiries.</p>
              <a href="mailto:billing@tunesence.com" className="text-primary hover:underline font-medium">
                billing@tunesence.com
              </a>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <Shield className="w-6 h-6 text-destructive mb-3" />
              <h3 className="text-foreground font-semibold mb-1">Copyright / DMCA Claims</h3>
              <p className="mb-3">For copyright takedown requests, counter-notifications, or IP-related concerns.</p>
              <a href="mailto:dmca@tunesence.com" className="text-primary hover:underline font-medium">
                dmca@tunesence.com
              </a>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <Clock className="w-6 h-6 text-muted-foreground mb-3" />
              <h3 className="text-foreground font-semibold mb-1">Response Times</h3>
              <p className="mb-1"><strong>General Support:</strong> 24-48 business hours</p>
              <p className="mb-1"><strong>Billing Issues:</strong> 24-48 business hours</p>
              <p className="mb-1"><strong>DMCA Notices:</strong> 48 business hours</p>
              <p><strong>Refund Requests:</strong> 2-3 business days</p>
            </div>
          </div>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Email Template for Support</h2>
            <p className="mb-2">To help us resolve your issue faster, please include the following in your email:</p>
            <div className="p-4 rounded-lg border border-border/60 bg-card font-mono text-xs">
              <p><strong>Subject:</strong> [Support / Billing / DMCA] — Brief description of issue</p>
              <p className="mt-2"><strong>Body:</strong></p>
              <p className="mt-1">1. Registered Email: [your email]</p>
              <p>2. Issue Type: [Technical / Payment / Copyright / Other]</p>
              <p>3. Description: [Detailed description of the issue]</p>
              <p>4. Payment ID (if billing): [Razorpay Payment ID]</p>
              <p>5. Browser & Device: [e.g., Chrome 120 / Windows 11]</p>
              <p>6. Screenshots / Evidence: [Attach if applicable]</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Business Information</h2>
            <div className="p-4 rounded-lg border border-border/60 bg-card">
              <p><strong>Business Name:</strong> TuneSence</p>
              <p><strong>Registered Address:</strong> [Your Registered Business Address, City, State, PIN Code, India]</p>
              <p><strong>Country of Operation:</strong> India</p>
              <p><strong>General Email:</strong> <a href="mailto:support@tunesence.com" className="text-primary hover:underline">support@tunesence.com</a></p>
              <p><strong>Billing Email:</strong> <a href="mailto:billing@tunesence.com" className="text-primary hover:underline">billing@tunesence.com</a></p>
              <p><strong>DMCA Email:</strong> <a href="mailto:dmca@tunesence.com" className="text-primary hover:underline">dmca@tunesence.com</a></p>
              <p><strong>Legal Email:</strong> <a href="mailto:legal@tunesence.com" className="text-primary hover:underline">legal@tunesence.com</a></p>
              <p><strong>Grievance Officer Email:</strong> <a href="mailto:grievance@tunesence.com" className="text-primary hover:underline">grievance@tunesence.com</a></p>
              <p><strong>Website:</strong> <a href="https://tunesence-magic.lovable.app" className="text-primary hover:underline">tunesence-magic.lovable.app</a></p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Grievance Redressal (India)</h2>
            <p>
              In accordance with the <strong>Information Technology Act, 2000</strong> and the <strong>Consumer Protection Act, 2019</strong>, if you have a grievance regarding the Platform or its services, you may contact our Grievance Officer:
            </p>
            <div className="mt-2 p-4 rounded-lg border border-border/60 bg-card">
              <p><strong>Grievance Officer:</strong> TuneSence Grievance Officer</p>
              <p><strong>Email:</strong> <a href="mailto:grievance@tunesence.com" className="text-primary hover:underline">grievance@tunesence.com</a></p>
              <p><strong>Resolution Timeline:</strong> Within 30 days of receipt of complaint, as mandated by law.</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border/40 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
          <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA & Copyright</Link>
          <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
