import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-6">Last updated: March 9, 2026</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Information We Collect</h2>
            <p>When you use TuneSence, we collect the following information:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Account Information:</strong> Email address, display name when you create an account.</li>
              <li><strong>Payment Information:</strong> Processed securely via Razorpay. We do not store your card details.</li>
              <li><strong>Usage Data:</strong> Audio conversion history (file names, modes used, timestamps).</li>
              <li><strong>Technical Data:</strong> Browser type, device info, IP address for analytics and security.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide, maintain, and improve our audio processing services.</li>
              <li>To process payments and manage subscriptions.</li>
              <li>To enforce usage limits and prevent abuse.</li>
              <li>To communicate service updates and promotional offers (with opt-out).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Data Storage & Security</h2>
            <p>Your data is stored securely using industry-standard encryption. Audio files are processed in real-time in your browser and are <strong>not uploaded or stored</strong> on our servers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Razorpay:</strong> For payment processing. Subject to <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Razorpay's Privacy Policy</a>.</li>
              <li><strong>Vercel Analytics:</strong> For anonymous usage analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Your Rights</h2>
            <p>You may request access to, correction of, or deletion of your personal data by contacting us at <a href="mailto:support@tunesence.com" className="text-primary hover:underline">support@tunesence.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Contact Us</h2>
            <p>For any questions regarding this Privacy Policy, contact us at <a href="mailto:support@tunesence.com" className="text-primary hover:underline">support@tunesence.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
