export const metadata = { title: "Privacy Policy — Sacrament Program Planner" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:py-16 bg-white text-zinc-900">
      <article className="max-w-2xl mx-auto prose prose-zinc prose-sm sm:prose-base">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-zinc-500">Last updated: May 11, 2026</p>

        <p>
          The Sacrament Program Planner (&ldquo;the app&rdquo;) is a private
          internal tool used by the bishopric of a single LDS branch to plan
          and coordinate sacrament meetings. This policy describes what
          information the app collects, how it is used, and how it is protected.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Member directory information</strong> entered by the
            bishopric: full name, mobile phone number (optional), assignment
            history, and notes about speaking categories.
          </li>
          <li>
            <strong>Assignment data:</strong> which member is assigned to speak
            on which date, the topic, and the response (accepted / declined /
            pending) recorded either by SMS reply or by the bishopric.
          </li>
          <li>
            <strong>App-account data</strong> for authorized users only
            (bishopric and chorister): email address and authentication tokens
            managed by Supabase Auth.
          </li>
        </ul>

        <h2>How information is used</h2>
        <ul>
          <li>
            To send speakers an SMS invitation to a specific Sunday meeting
            with their assigned topic and a one-tap link to confirm or decline.
          </li>
          <li>
            To send a reminder SMS two days before the meeting the speaker
            previously confirmed.
          </li>
          <li>
            To display upcoming assignments to the bishopric so they can plan
            the rotation and follow up on pending invitations.
          </li>
        </ul>

        <h2>What we do not do</h2>
        <ul>
          <li>
            We do <strong>not</strong> sell, rent, or share personal information
            with any third party.
          </li>
          <li>
            We do <strong>not</strong> use the information for marketing,
            advertising, or any commercial purpose.
          </li>
          <li>
            We do <strong>not</strong> share data with other congregations,
            companies, or organizations.
          </li>
        </ul>

        <h2>Service providers we use</h2>
        <p>
          We rely on the following service providers to operate the app. Each
          handles only the data needed to deliver its specific function:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> &mdash; secure storage of the data above
            (US-based, encrypted at rest and in transit).
          </li>
          <li>
            <strong>Vercel</strong> &mdash; hosts the application.
          </li>
          <li>
            <strong>Twilio</strong> &mdash; delivers SMS messages on our behalf.
            Twilio receives the recipient&rsquo;s phone number and the message
            body in order to deliver it.
          </li>
        </ul>

        <h2>Your rights</h2>
        <p>
          You may ask the bishopric to remove your phone number from the
          directory at any time. You may also reply STOP to any SMS to stop
          receiving messages immediately. To request that your information be
          fully deleted, contact the bishopric directly.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy can be directed to the bishop of the
          branch using this app.
        </p>
      </article>
    </main>
  );
}
