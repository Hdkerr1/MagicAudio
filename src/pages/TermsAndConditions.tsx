import { useNavigate } from 'react-router-dom';

const TermsAndConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-6">Terms & Conditions</h1>
        <p className="text-muted-foreground text-sm mb-6">Last updated: March 9, 2026</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using TuneSence ("the Service"), you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Service Description</h2>
            <p>TuneSence is a web-based audio effects processor that applies real-time effects (Slowed+Reverb, Remix, Lo-Fi) to user-provided audio files. All processing occurs client-side in the browser.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. User Accounts</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 13 years of age to use the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Free & Premium Plans</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Free Plan:</strong> 5 audio conversions per day. All features available.</li>
              <li><strong>Premium Plan:</strong> ₹399/month. Unlimited conversions and priority processing.</li>
              <li>Premium subscriptions are billed monthly via Razorpay.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Intellectual Property</h2>
            <p>You retain all rights to your audio files. TuneSence does not claim ownership of any content you process. You must have the right to use any audio files you upload.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Prohibited Use</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Processing copyrighted content without authorization.</li>
              <li>Attempting to reverse-engineer or exploit the Service.</li>
              <li>Using automated tools to abuse the free tier limits.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Limitation of Liability</h2>
            <p>TuneSence is provided "as is" without warranty. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the Service constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Contact</h2>
            <p>For questions about these terms, email us at <a href="mailto:support@tunesence.com" className="text-primary hover:underline">support@tunesence.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
