export const metadata = { title: "SMS Terms — Sacrament Program Planner" };

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:py-16 bg-white text-zinc-900">
      <article className="max-w-2xl mx-auto prose prose-zinc prose-sm sm:prose-base">
        <h1 className="text-3xl font-semibold tracking-tight">SMS Terms of Service</h1>
        <p className="text-sm text-zinc-500">Last updated: May 11, 2026</p>

        <h2>Program name</h2>
        <p>Sacrament Program Planner &mdash; Speaker Notifications.</p>

        <h2>Program description</h2>
        <p>
          The bishopric of a single LDS branch uses this program to invite
          volunteer members of the congregation to be a speaker in an upcoming
          sacrament meeting and to send reminders. Recipients are only people
          whose phone numbers have been recorded in the branch&rsquo;s internal
          directory with their verbal consent.
        </p>

        <h2>Message types</h2>
        <ul>
          <li>
            <strong>Invitation:</strong> &ldquo;Hi [Name], would you be willing
            to speak in sacrament meeting on [Date]&hellip;&rdquo; with a link
            to confirm or decline.
          </li>
          <li>
            <strong>Reminder:</strong> sent 2 days before the meeting the
            recipient previously confirmed, restating the date, slot, and topic.
          </li>
          <li>
            <strong>Confirmation:</strong> a short reply after the recipient
            answers, e.g. &ldquo;Thanks, you&rsquo;re confirmed.&rdquo;
          </li>
        </ul>

        <h2>Message frequency</h2>
        <p>
          Up to <strong>2 messages per recipient per assignment</strong> (one
          invitation, one optional reminder). Most recipients receive 0&ndash;3
          messages per year.
        </p>

        <h2>Cost</h2>
        <p>
          Standard <strong>message and data rates may apply</strong> from your
          mobile carrier. The branch does not charge for these messages.
        </p>

        <h2>How to get HELP</h2>
        <p>
          Reply <strong>HELP</strong> to any message to receive a short
          description of the program and instructions for opting out, or
          contact the bishopric directly.
        </p>

        <h2>How to opt out (STOP)</h2>
        <p>
          Reply <strong>STOP</strong> to any message at any time to be
          immediately and permanently unsubscribed from this program. You will
          receive a one-time confirmation that you have been unsubscribed.
        </p>

        <h2>Consent</h2>
        <p>
          Members are only added to the directory after giving verbal consent
          to receive these notifications. The bishopric will remove a member
          from the directory upon request.
        </p>

        <h2>Privacy</h2>
        <p>
          See our <a href="/privacy">Privacy Policy</a> for how information is
          handled.
        </p>

        <h2>Contact</h2>
        <p>
          Questions can be directed to the bishop of the branch using this app.
        </p>
      </article>
    </main>
  );
}
