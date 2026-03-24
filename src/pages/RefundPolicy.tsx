import { useNavigate, Link } from 'react-router-dom';

const RefundPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-2">Refund & Cancellation Policy</h1>
        <p className="text-muted-foreground text-sm mb-2">Effective Date: March 9, 2026</p>
        <p className="text-muted-foreground text-sm mb-8">Last Updated: March 24, 2026</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <p>
            This Refund & Cancellation Policy outlines the terms under which refunds and cancellations are processed for TuneSence Premium subscriptions. This policy is mandatory for payment gateway compliance and applies to all transactions processed through Razorpay.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Subscription Plans</h2>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 text-foreground font-medium">Plan</th>
                  <th className="text-left py-2 text-foreground font-medium">Price</th>
                  <th className="text-left py-2 text-foreground font-medium">Billing</th>
                  <th className="text-left py-2 text-foreground font-medium">Refundable</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/20">
                  <td className="py-2">Free</td>
                  <td className="py-2">₹0</td>
                  <td className="py-2">N/A</td>
                  <td className="py-2">N/A</td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2">Premium Monthly</td>
                  <td className="py-2">₹399/month</td>
                  <td className="py-2">Monthly recurring</td>
                  <td className="py-2">Conditional (see below)</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Cancellation Policy</h2>
            <h3 className="text-base font-medium text-foreground mb-1">2.1 How to Cancel</h3>
            <p>You may cancel your Premium subscription at any time by contacting us at <a href="mailto:billing@tunesence.com" className="text-primary hover:underline">billing@tunesence.com</a>.</p>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">2.2 Effect of Cancellation</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cancellation takes effect at the <strong>end of the current billing cycle</strong>.</li>
              <li>You will retain full access to Premium features until the billing period expires.</li>
              <li>No further charges will be made after cancellation.</li>
              <li>Your account will automatically revert to the Free Plan (5 conversions/day).</li>
              <li>No data will be lost upon downgrade.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Refund Policy</h2>

            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 mb-4">
              <p className="text-foreground font-medium">⚠️ Digital Service — No Refunds After Successful Delivery</p>
              <p className="mt-1">Once an audio file has been <strong>successfully processed and downloaded</strong> by the user, the digital service is considered fully delivered. <strong>No refunds will be issued</strong> for successfully completed processing jobs.</p>
            </div>

            <h3 className="text-base font-medium text-foreground mb-1">3.1 Eligible for Refund</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Technical failure during processing:</strong> If our platform experiences a verified server-side error that prevents your audio file from being processed or causes the output to be corrupted, silent, or materially defective (e.g., empty file, truncated output), you are entitled to a full refund for that transaction.</li>
              <li><strong>Processing not completed:</strong> If you paid for a processing job that never completed due to a platform-side issue (not due to your internet connection or file format), a full refund will be issued.</li>
              <li><strong>Duplicate charges:</strong> Full refund for any accidental or erroneous duplicate payments.</li>
              <li><strong>Unauthorized transactions:</strong> Full refund for payments made without your authorization (subject to verification).</li>
              <li><strong>Subscription — within 48 hours:</strong> Premium subscription payments may be refunded within 48 hours of purchase if no audio processing jobs have been completed under the subscription during that period.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">3.2 Not Eligible for Refund</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Successfully processed and downloaded files:</strong> Once you have downloaded the enhanced audio file, the service is deemed fully delivered. No refunds will be issued regardless of subjective dissatisfaction with the audio quality or output.</li>
              <li>Dissatisfaction with the <strong>subjective quality</strong> of the audio output (e.g., "the remix doesn't sound how I expected"). Audio enhancement results vary based on source material and are inherently subjective.</li>
              <li>Partial month usage after the 48-hour subscription refund window has passed.</li>
              <li>Change of mind or preference after the 48-hour period.</li>
              <li>Account suspension or termination due to violation of our <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>.</li>
              <li>Failure to use the service during the billing period (non-usage does not constitute grounds for a refund).</li>
              <li>Issues caused by the user's browser, device, internet connection, or unsupported file formats.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">3.3 Per-File / One-Time Purchases</h3>
            <p>For any per-file or one-time purchase transactions: <strong>No refunds will be issued once the processed audio has been successfully downloaded or exported.</strong> The download/export action constitutes full delivery of the digital product and irrevocable acceptance of the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. How to Request a Refund</h2>
            <p>To request a refund, send an email to our billing team with the following information:</p>
            <div className="mt-2 p-4 rounded-lg border border-border/60 bg-card">
              <p><strong>To:</strong> <a href="mailto:billing@tunesence.com" className="text-primary hover:underline">billing@tunesence.com</a></p>
              <p><strong>Subject:</strong> Refund Request — [Your Email Address]</p>
              <p className="mt-2"><strong>Required Information:</strong></p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Your registered email address</li>
                <li>Razorpay Payment ID (from your payment confirmation email or Razorpay receipt)</li>
                <li>Date of payment</li>
                <li>Reason for the refund request</li>
                <li>Any supporting evidence (screenshots, error messages)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Refund Processing</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Refund requests are reviewed within <strong>2-3 business days</strong>.</li>
              <li>Approved refunds are processed through Razorpay to the original payment method.</li>
              <li>Refund amount will reflect in your account within <strong>5-10 business days</strong>, depending on your bank or payment provider.</li>
              <li>You will receive email confirmation once the refund is processed.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Disputes</h2>
            <p>
              If you are unsatisfied with our refund decision, you may escalate the matter by writing to <a href="mailto:legal@tunesence.com" className="text-primary hover:underline">legal@tunesence.com</a>. We will review the dispute within 15 business days and provide a final resolution.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Contact for Billing Issues</h2>
            <div className="mt-2 p-4 rounded-lg border border-border/60 bg-card">
              <p><strong>Billing Support:</strong> <a href="mailto:billing@tunesence.com" className="text-primary hover:underline">billing@tunesence.com</a></p>
              <p><strong>General Support:</strong> <a href="mailto:support@tunesence.com" className="text-primary hover:underline">support@tunesence.com</a></p>
              <p><strong>Response Time:</strong> Within 24-48 business hours.</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border/40 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
          <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA & Copyright</Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;
