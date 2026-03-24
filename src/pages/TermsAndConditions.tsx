import { useNavigate, Link } from 'react-router-dom';

const TermsAndConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-2">Effective Date: March 9, 2026</p>
        <p className="text-muted-foreground text-sm mb-8">Last Updated: March 24, 2026</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <p>
            These Terms of Service ("Terms") govern your access to and use of TuneSence ("the Platform," "we," "our," or "us"), a SaaS-based audio enhancement platform operated out of India. By accessing or using the Platform, you agree to be legally bound by these Terms. If you do not agree, you must discontinue use immediately.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Definitions</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>"User"</strong> refers to any individual who creates an account and accesses the Platform.</li>
              <li><strong>"Service"</strong> refers to the audio enhancement and processing capabilities provided by TuneSence, including Slowed+Reverb, Remix, and Lo-Fi modes.</li>
              <li><strong>"Content"</strong> refers to any audio files, data, or materials uploaded or processed through the Platform.</li>
              <li><strong>"Subscription"</strong> refers to a paid plan granting access to premium features.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Eligibility</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must be at least <strong>13 years of age</strong> (or 16 in the EU) to use the Platform.</li>
              <li>By creating an account, you represent that the information you provide is accurate, complete, and current.</li>
              <li>You are solely responsible for maintaining the confidentiality and security of your account credentials.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Description of Service</h2>
            <p>TuneSence provides a cloud-based audio enhancement platform that applies professional-grade DSP (Digital Signal Processing) effects to user-uploaded audio files. Users upload their audio (e.g., MP3), our backend processes it using various audio engines, and users download the enhanced version. The Platform:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Temporarily stores uploaded audio files <strong>only for the duration of processing</strong>, after which they are automatically deleted (see our <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link> for details).</li>
              <li>Does <strong>not</strong> provide, supply, or recommend any music or copyrighted audio files.</li>
              <li>Does <strong>not</strong> use uploaded audio to train AI or machine learning models.</li>
              <li>Functions solely as a <strong>professional audio enhancement tool</strong>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. User Responsibilities & Content Ownership</h2>
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 mb-3">
              <p className="text-foreground font-medium">⚠️ Critical: Audio Upload Responsibility</p>
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>You <strong>retain full ownership</strong> of all audio files you upload and process through the Platform.</li>
              <li>You represent and warrant that you have the <strong>legal right, license, or explicit permission</strong> to upload, modify, and process any audio file you submit to the Platform.</li>
              <li>You agree <strong>not to upload</strong> any audio content that you do not own or have authorization to modify.</li>
              <li>TuneSence assumes <strong>zero liability</strong> for any copyright infringement, intellectual property violation, or unauthorized use of audio content committed by users.</li>
              <li>You agree to <strong>indemnify, defend, and hold harmless</strong> TuneSence, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your violation of this section.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Subscription Plans & Billing</h2>
            <h3 className="text-base font-medium text-foreground mb-1">5.1 Free Plan</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>5 audio conversions per calendar day (resets at midnight UTC).</li>
              <li>Access to all audio modes (Slowed+Reverb, Remix, Lo-Fi).</li>
              <li>Real-time preview and MP3 export.</li>
              <li>No credit card required.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">5.2 Premium Plan — ₹399/month</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Unlimited audio conversions.</li>
              <li>All features of the Free Plan.</li>
              <li>Priority processing.</li>
              <li>Early access to new audio modes and features.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">5.3 Billing Cycle</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Premium subscriptions are billed <strong>monthly</strong> from the date of initial purchase.</li>
              <li>All payments are processed securely through <strong>Razorpay</strong>.</li>
              <li>Prices are in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise.</li>
              <li>We reserve the right to modify pricing with <strong>30 days' prior notice</strong> to existing subscribers.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-1">5.4 Failed Payments</h3>
            <p>If a recurring payment fails, we will attempt to process the payment up to 3 times over 7 days. If all attempts fail, your account will be downgraded to the Free Plan. No data will be lost.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Cancellation & Refunds</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You may cancel your Premium subscription at any time.</li>
              <li>Cancellation takes effect at the <strong>end of the current billing cycle</strong>. You will retain Premium access until then.</li>
              <li>Refunds are subject to our <Link to="/refund-policy" className="text-primary hover:underline">Refund & Cancellation Policy</Link>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Prohibited Activities</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Upload, process, or distribute copyrighted audio without proper authorization.</li>
              <li>Use the Platform for any illegal, fraudulent, or unauthorized purpose.</li>
              <li>Attempt to reverse-engineer, decompile, or extract the source code of the Platform's audio processing algorithms.</li>
              <li>Use automated bots, scripts, or tools to circumvent free-tier usage limits.</li>
              <li>Interfere with, disrupt, or compromise the integrity or security of the Platform.</li>
              <li>Resell, sublicense, or commercially redistribute processed audio in a manner that competes with the Platform.</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Account Termination</h2>
            <p>We reserve the right to <strong>suspend or terminate</strong> your account, without prior notice, if:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>You violate any provision of these Terms.</li>
              <li>You engage in prohibited activities as described in Section 7.</li>
              <li>We receive a valid copyright infringement notice related to your usage.</li>
              <li>Your account is used for fraudulent or abusive purposes.</li>
            </ul>
            <p className="mt-2">Upon termination, your access to the Platform will be revoked. No refund will be issued for terminations resulting from Terms violations.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Intellectual Property</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>The TuneSence brand, logo, UI design, audio processing algorithms, and all related intellectual property are owned exclusively by TuneSence.</li>
              <li>You are granted a <strong>limited, non-exclusive, non-transferable, revocable license</strong> to use the Platform for personal, non-commercial purposes.</li>
              <li>Nothing in these Terms grants you any right, title, or interest in TuneSence's intellectual property.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Disclaimer of Warranties</h2>
            <p>
              THE PLATFORM IS PROVIDED <strong>"AS IS"</strong> AND <strong>"AS AVAILABLE"</strong> WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li><strong>No Uptime Guarantee:</strong> We do not warrant that the Service will be uninterrupted, error-free, or available at all times. Scheduled maintenance, server outages, and unforeseen technical issues may temporarily affect availability. We will make commercially reasonable efforts to maintain high uptime but provide no specific SLA guarantee.</li>
              <li><strong>Subjective Audio Quality:</strong> Audio enhancement results are inherently subjective. We do not guarantee that the output of any audio processing mode will meet your personal expectations, artistic standards, or specific quality benchmarks. The quality of the enhanced audio depends on multiple factors including the quality of the original source file, the selected processing mode, and parameter settings chosen by the user.</li>
              <li><strong>No Guarantee of Compatibility:</strong> We do not warrant that processed audio files will be compatible with all playback devices, software, or platforms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TUNESENCE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE PLATFORM.
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO TUNESENCE IN THE <strong>12 MONTHS</strong> PRECEDING THE CLAIM.</li>
              <li>WE ARE NOT LIABLE FOR ANY LOSS OR CORRUPTION OF AUDIO FILES DURING UPLOAD, PROCESSING, OR DOWNLOAD.</li>
              <li>WE ARE NOT LIABLE FOR THE SUBJECTIVE QUALITY, ARTISTIC MERIT, OR SUITABILITY OF THE PROCESSED AUDIO OUTPUT.</li>
              <li>WE ARE NOT LIABLE FOR SERVICE INTERRUPTIONS, DOWNTIME, OR DELAYS IN PROCESSING CAUSED BY FACTORS BEYOND OUR REASONABLE CONTROL.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless TuneSence and its affiliates, officers, directors, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from: (a) your use of the Platform; (b) your violation of these Terms; (c) your violation of any third-party rights, including intellectual property rights; or (d) any content you upload or process through the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">13. Governing Law & Dispute Resolution</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>These Terms shall be governed by and construed in accordance with the <strong>laws of India</strong>.</li>
              <li>Any dispute arising under these Terms shall be subject to the <strong>exclusive jurisdiction of the courts in India</strong>.</li>
              <li>Before initiating legal proceedings, both parties agree to attempt resolution through good-faith negotiation for a period of 30 days.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">14. Modifications to Terms</h2>
            <p>We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated "Last Updated" date. Material changes will be communicated via email to registered users. Continued use of the Platform after modifications constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">15. Severability</h2>
            <p>If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">16. Contact</h2>
            <p>For questions about these Terms:</p>
            <div className="mt-2 p-4 rounded-lg border border-border/60 bg-card">
              <p><strong>Email:</strong> <a href="mailto:legal@tunesence.com" className="text-primary hover:underline">legal@tunesence.com</a></p>
              <p><strong>Website:</strong> <a href="https://tunesence-magic.lovable.app/contact" className="text-primary hover:underline">tunesence-magic.lovable.app/contact</a></p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border/40 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA & Copyright</Link>
          <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
