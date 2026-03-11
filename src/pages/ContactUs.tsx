import { useNavigate } from 'react-router-dom';
import { Mail, MessageSquare } from 'lucide-react';

const ContactUs = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-6">Contact Us</h1>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>We'd love to hear from you! Reach out for support, feedback, or business inquiries.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <Mail className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-foreground font-semibold mb-1">Email Support</h3>
              <p className="text-muted-foreground mb-3">For billing, technical issues, or general inquiries.</p>
              <a href="mailto:support@tunesence.com" className="text-primary hover:underline font-medium">
                support@tunesence.com
              </a>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <MessageSquare className="w-6 h-6 text-accent mb-3" />
              <h3 className="text-foreground font-semibold mb-1">Response Time</h3>
              <p className="text-muted-foreground">We typically respond within 24-48 hours on business days.</p>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-foreground mb-2">Business Details</h2>
            <ul className="space-y-1">
              <li><strong>Business Name:</strong> TuneSence</li>
              <li><strong>Email:</strong> support@tunesence.com</li>
              <li><strong>Website:</strong> <a href="https://tunesence-magic.lovable.app" className="text-primary hover:underline">tunesence-magic.lovable.app</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
