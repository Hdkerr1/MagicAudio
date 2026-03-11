import { useNavigate } from 'react-router-dom';

const RefundPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-6">Refund & Cancellation Policy</h1>
        <p className="text-muted-foreground text-sm mb-6">Last updated: March 9, 2026</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Subscription Cancellation</h2>
            <p>You may cancel your Premium subscription at any time. Upon cancellation:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your Premium access will continue until the end of the current billing period.</li>
              <li>No further charges will be made after cancellation.</li>
              <li>Your account will revert to the Free plan with 5 daily conversions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Refund Eligibility</h2>
            <p>Refunds are available under the following conditions:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Within 48 hours of payment:</strong> Full refund if the service did not meet expectations.</li>
              <li><strong>Technical issues:</strong> If persistent technical issues prevented you from using the service, a pro-rata refund will be issued.</li>
              <li><strong>Duplicate charges:</strong> Full refund for any accidental duplicate payments.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Non-Refundable Cases</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Partial month usage after the 48-hour window.</li>
              <li>Violation of Terms & Conditions leading to account suspension.</li>
              <li>Change of mind after the 48-hour period.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. How to Request a Refund</h2>
            <p>To request a refund, email us at <a href="mailto:support@tunesence.com" className="text-primary hover:underline">support@tunesence.com</a> with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your registered email address</li>
              <li>Razorpay payment ID (from your payment confirmation email)</li>
              <li>Reason for the refund request</li>
            </ul>
            <p className="mt-2">Refunds are typically processed within 5-7 business days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Contact</h2>
            <p>For any refund-related queries, reach out to <a href="mailto:support@tunesence.com" className="text-primary hover:underline">support@tunesence.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;
