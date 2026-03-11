import { useNavigate, Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-2">Effective Date: March 9, 2026</p>
        <p className="text-muted-foreground text-sm mb-8">Last Updated: March 9, 2026</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <p>
            TuneSence ("we," "our," or "us") is a SaaS-based audio enhancement platform operated out of India. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you access or use our website and services at{' '}
            <a href="https://tunesence-magic.lovable.app" className="text-primary hover:underline">tunesence-magic.lovable.app</a> (the "Platform").
          </p>
          <p>
            By using the Platform, you consent to the data practices described in this policy. This policy is drafted in compliance with the <strong>Information Technology Act, 2000</strong> (India), the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong>, the <strong>EU General Data Protection Regulation (GDPR)</strong>, and the <strong>California Consumer Privacy Act (CCPA)</strong>.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <h3 className="text-base font-medium text-foreground mb-1">1.1 Account Information</h3>
            <p>When you register an account, we collect:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Email address</li>
              <li>Display name (optional)</li>
              <li>Account creation timestamp</li>
              <li>Authentication credentials (hashed and salted; we never store plaintext passwords)</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">1.2 Audio File Data — Zero Retention Policy</h3>
            <p>
              Audio files uploaded to TuneSence are processed <strong>entirely within your browser (client-side)</strong> using Web Audio API and Digital Signal Processing (DSP) algorithms. <strong>Your audio files are never uploaded to, stored on, or transmitted to our servers.</strong>
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Audio data exists only in volatile browser memory during the active session.</li>
              <li>Once the browser tab is closed or a new file is loaded, all audio data is permanently and irreversibly discarded.</li>
              <li>We have <strong>zero access</strong> to the content, metadata, or any derivative of your audio files.</li>
              <li>No audio fingerprinting, content identification, or analysis is performed server-side.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">1.3 Usage Data</h3>
            <p>We collect anonymized usage metadata to enforce free-tier limits and improve the Platform:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>File name (for user's own reference in conversion history)</li>
              <li>Audio mode selected (e.g., Slowed+Reverb, Lo-Fi)</li>
              <li>Conversion timestamps</li>
              <li>Daily conversion count</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">1.4 Payment Information</h3>
            <p>
              All payment transactions are processed exclusively through <strong>Razorpay</strong>, a PCI-DSS Level 1 compliant payment gateway. We <strong>do not collect, process, store, or have access to</strong> your credit card numbers, debit card numbers, bank account details, or UPI credentials. We only receive:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Razorpay Payment ID (transaction reference)</li>
              <li>Razorpay Order ID</li>
              <li>Payment status (success/failure)</li>
              <li>Subscription status</li>
            </ul>
            <p className="mt-2">
              For information on how Razorpay handles your payment data, please refer to{' '}
              <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Razorpay's Privacy Policy</a>.
            </p>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">1.5 Technical Data</h3>
            <p>We automatically collect:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Browser type and version</li>
              <li>Operating system</li>
              <li>IP address (anonymized for analytics)</li>
              <li>Referring URL</li>
              <li>Pages visited and session duration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <p>We use collected information for the following purposes:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Service Delivery:</strong> To authenticate users, enforce usage limits, and provide the audio processing service.</li>
              <li><strong>Payment Processing:</strong> To manage subscriptions, verify payment status, and activate premium features.</li>
              <li><strong>Platform Improvement:</strong> To analyze usage patterns (anonymized) and improve features and performance.</li>
              <li><strong>Communication:</strong> To send transactional emails (payment receipts, account alerts) and, with your explicit consent, promotional updates.</li>
              <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes.</li>
              <li><strong>Security:</strong> To detect, prevent, and address fraud, abuse, and security threats.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Legal Basis for Processing (GDPR)</h2>
            <p>For users in the European Economic Area, we process personal data under the following legal bases:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Contractual Necessity:</strong> Processing required to deliver the service you subscribed to.</li>
              <li><strong>Legitimate Interest:</strong> Analytics, security, and platform improvement.</li>
              <li><strong>Consent:</strong> Marketing communications (opt-in only).</li>
              <li><strong>Legal Obligation:</strong> Compliance with applicable laws.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Data Sharing & Disclosure</h2>
            <p>We do <strong>not sell, rent, or trade</strong> your personal information. We may share data with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Razorpay:</strong> For payment processing (subject to their privacy policy).</li>
              <li><strong>Vercel Analytics:</strong> For anonymous, aggregated website analytics.</li>
              <li><strong>Law Enforcement:</strong> When required by law, court order, or to protect our legal rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account Data:</strong> Retained for the duration of your account. Deleted within 30 days of account deletion request.</li>
              <li><strong>Conversion History:</strong> Retained for 90 days for usage tracking, then automatically purged.</li>
              <li><strong>Audio Files:</strong> Never stored. Zero retention. See Section 1.2.</li>
              <li><strong>Payment Records:</strong> Retained for 7 years as required by Indian tax and financial regulations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>TLS/SSL encryption for all data in transit</li>
              <li>AES-256 encryption for data at rest</li>
              <li>Row-Level Security (RLS) policies ensuring users can only access their own data</li>
              <li>Secure authentication with hashed credentials</li>
              <li>Regular security audits and vulnerability assessments</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Your Rights</h2>
            <h3 className="text-base font-medium text-foreground mb-1">7.1 Under GDPR (EU Users)</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Right of Access:</strong> Request a copy of your personal data.</li>
              <li><strong>Right to Rectification:</strong> Correct inaccurate personal data.</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your personal data ("Right to be Forgotten").</li>
              <li><strong>Right to Restrict Processing:</strong> Limit how we use your data.</li>
              <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong>Right to Object:</strong> Object to processing based on legitimate interest.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">7.2 Under CCPA (California Users)</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Right to know what personal information is collected and how it is used.</li>
              <li>Right to delete personal information.</li>
              <li>Right to opt out of the sale of personal information (we do not sell personal data).</li>
              <li>Right to non-discrimination for exercising your privacy rights.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">7.3 Under Indian IT Act</h3>
            <p>You have the right to access and correct your sensitive personal data or information held by us, as defined under the IT (SPDI) Rules, 2011.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Cookies</h2>
            <p>We use essential cookies for:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Authentication:</strong> To maintain your login session.</li>
              <li><strong>Analytics:</strong> Anonymous usage analytics via Vercel (no personally identifiable information).</li>
            </ul>
            <p className="mt-2">We do not use advertising or tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Children's Privacy</h2>
            <p>The Platform is not intended for users under the age of 13 (or 16 in the EU). We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us immediately.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. Changes will be posted on this page with an updated "Last Updated" date. Continued use of the Platform after changes constitutes acceptance of the revised policy. Material changes will be communicated via email to registered users.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Grievance Officer (India)</h2>
            <p>In accordance with the Information Technology Act, 2000 and rules made thereunder, the Grievance Officer for the purpose of this Privacy Policy is:</p>
            <div className="mt-2 p-4 rounded-lg border border-border/60 bg-card">
              <p><strong>Name:</strong> TuneSence Grievance Officer</p>
              <p><strong>Email:</strong> <a href="mailto:grievance@tunesence.com" className="text-primary hover:underline">grievance@tunesence.com</a></p>
              <p><strong>Response Time:</strong> Within 30 days of receipt of complaint.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Contact Us</h2>
            <p>For any privacy-related inquiries, data requests, or complaints:</p>
            <div className="mt-2 p-4 rounded-lg border border-border/60 bg-card">
              <p><strong>Email:</strong> <a href="mailto:privacy@tunesence.com" className="text-primary hover:underline">privacy@tunesence.com</a></p>
              <p><strong>Website:</strong> <a href="https://tunesence-magic.lovable.app/contact" className="text-primary hover:underline">tunesence-magic.lovable.app/contact</a></p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border/40 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
          <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA & Copyright</Link>
          <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
