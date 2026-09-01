import { AuthGate } from "./components/AuthGate";

export default function App() {
  return (
    <AuthGate>
      {/* Screens land in step 4: Board → Animal → Log sheet → Add animal */}
      <div className="min-h-svh bg-paper px-4 py-6">
        <h1 className="font-serif text-3xl text-ink">Barn Book</h1>
        <p className="mt-2 text-soft">Signed in. The board is on its way.</p>
      </div>
    </AuthGate>
  );
}
