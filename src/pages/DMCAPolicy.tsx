import { useNavigate, Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

const DMCAPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">
          ← Back
        </button>
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-7 h-7 text-primary" />
          <h1 className="text-3xl font-bold">DMCA & Copyright Disclaimer</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-2">Effective Date: March 9, 2026</p>
        <p className="text-muted-foreground text-sm mb-8">Last Updated: March 9, 2026</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Platform Nature & Safe Harbor Statement</h2>
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 mb-4">
              <p className="text-foreground font-medium mb-2">🛡️ Safe Harbor Declaration</p>
              <p>
                TuneSence operates as a <strong>neutral, automated audio processing tool</strong>. The Platform qualifies for "Safe Harbor" protections under the <strong>Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512</strong>, the <strong>EU Copyright Directive (Article 17)</strong>, and the <strong>Information Technology Act, 2000 (India) — Section 79 (Intermediary Guidelines)</strong>.
              </p>
            </div>
            <p>TuneSence:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Does NOT host, store, stream, or distribute</strong> any audio files or copyrighted content.</li>
              <li><strong>Does NOT provide, recommend, curate, or supply</strong> any music, songs, or audio recordings.</li>
              <li><strong>Does NOT function</strong> as a music library, streaming service, download platform, or content distribution network.</li>
              <li>Operates exclusively as a <strong>client-side audio effects processor</strong> — a digital tool analogous to an equalizer, audio editor, or digital audio workstation (DAW).</li>
              <li>All audio processing occurs <strong>entirely within the user's browser</strong>. Audio files are never transmitted to, stored on, or accessible by our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. User Responsibility for Uploaded Content</h2>
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 mb-3">
              <p className="text-foreground font-medium">⚠️ Legal Responsibility Notice</p>
            </div>
            <p>By uploading any audio file to TuneSence, you explicitly represent and warrant that:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>You are the <strong>original creator and copyright holder</strong> of the audio content; <strong>OR</strong></li>
              <li>You have obtained <strong>explicit written license, permission, or authorization</strong> from the copyright holder to modify, process, and create derivative works from the audio; <strong>OR</strong></li>
              <li>The audio content is in the <strong>public domain</strong> or is licensed under a permissive license (e.g., Creative Commons) that permits modification; <strong>OR</strong></li>
              <li>Your use constitutes <strong>fair use/fair dealing</strong> under applicable copyright law (personal, non-commercial, transformative use).</li>
            </ul>
            <p className="mt-3">
              <strong>TuneSence assumes absolutely zero liability</strong> for any copyright infringement, intellectual property violation, or unauthorized use of audio content committed by end-users. Any legal consequences arising from the unauthorized processing of copyrighted material are <strong>solely the responsibility of the user</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Intermediary Status (Indian IT Act, Section 79)</h2>
            <p>
              In accordance with <strong>Section 79 of the Information Technology Act, 2000</strong> and the <strong>Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</strong>, TuneSence functions as an "intermediary" as defined under the Act.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>We do not initiate, select, or modify the content processed through our Platform.</li>
              <li>We act as a <strong>passive conduit</strong> providing technical tools for audio manipulation.</li>
              <li>We comply with all obligations placed upon intermediaries, including due diligence requirements.</li>
              <li>Upon receiving actual knowledge or a valid court order regarding infringing content or activity, we will take appropriate action including, but not limited to, account suspension or termination.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. DMCA Takedown Procedure</h2>
            <p>
              Although TuneSence does not host or store any user-uploaded audio content, we respect intellectual property rights and will respond to valid DMCA takedown notices regarding any content or activity on our Platform.
            </p>

            <h3 className="text-base font-medium text-foreground mt-4 mb-2">4.1 Filing a DMCA Takedown Notice</h3>
            <p>If you believe your copyrighted work has been infringed upon through the use of our Platform, please submit a written notice to our Designated Copyright Agent containing:</p>
            <ol className="list-decimal pl-5 mt-2 space-y-2">
              <li>A <strong>physical or electronic signature</strong> of the copyright owner or a person authorized to act on their behalf.</li>
              <li><strong>Identification of the copyrighted work</strong> claimed to have been infringed.</li>
              <li><strong>Identification of the infringing material</strong> or activity, with sufficient information to locate it.</li>
              <li>Your <strong>contact information</strong> — full name, mailing address, telephone number, and email address.</li>
              <li>A statement that you have a <strong>good faith belief</strong> that the use of the material is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement, made <strong>under penalty of perjury</strong>, that the information in the notice is accurate and that you are authorized to act on behalf of the copyright owner.</li>
            </ol>

            <h3 className="text-base font-medium text-foreground mt-4 mb-2">4.2 Designated Copyright Agent</h3>
            <div className="mt-2 p-4 rounded-lg border border-border/60 bg-card">
              <p><strong>Attention:</strong> DMCA Copyright Agent</p>
              <p><strong>Entity:</strong> TuneSence</p>
              <p><strong>Email:</strong> <a href="mailto:dmca@tunesence.com" className="text-primary hover:underline">dmca@tunesence.com</a></p>
              <p><strong>Subject Line:</strong> DMCA Takedown Notice — [Your Name / Organization]</p>
              <p><strong>Response Time:</strong> Within 48 business hours of receipt.</p>
            </div>

            <h3 className="text-base font-medium text-foreground mt-4 mb-2">4.3 Counter-Notification</h3>
            <p>If you believe your content was wrongly removed or restricted, you may submit a counter-notification containing:</p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Your physical or electronic signature.</li>
              <li>Identification of the material that was removed or disabled.</li>
              <li>A statement under penalty of perjury that you have a good faith belief the material was removed by mistake or misidentification.</li>
              <li>Your name, address, telephone number, and a statement consenting to the jurisdiction of the courts in India.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Repeat Infringer Policy</h2>
            <p>In accordance with DMCA requirements and our commitment to intellectual property protection:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>First Offense:</strong> Written warning and account flagged.</li>
              <li><strong>Second Offense:</strong> Account suspended for 30 days.</li>
              <li><strong>Third Offense:</strong> Permanent account termination with no refund.</li>
            </ul>
            <p className="mt-2">We reserve the right to terminate accounts in response to even a single instance of egregious or willful copyright infringement.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Fair Use Disclaimer</h2>
            <p>
              TuneSence acknowledges the doctrine of <strong>fair use</strong> (17 U.S.C. § 107) and <strong>fair dealing</strong> under Indian copyright law. Personal, non-commercial, transformative use of audio content (such as applying effects for personal listening) may qualify as fair use. However, this determination is ultimately a legal question that depends on the specific facts and circumstances of each case. TuneSence does not provide legal advice and encourages users to consult with a qualified attorney regarding their specific use case.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. No Endorsement</h2>
            <p>
              The availability of audio processing features on TuneSence does not constitute an endorsement, encouragement, or facilitation of copyright infringement. The Platform is a neutral tool, and users bear full responsibility for ensuring their use complies with applicable copyright laws.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border/40 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
          <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link>
        </div>
      </div>
    </div>
  );
};

export default DMCAPolicy;
