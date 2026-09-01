import { AuthGate, signOut } from "./components/AuthGate";
import { useRoute } from "./lib/router";
import { AddAnimal } from "./screens/AddAnimal";
import { AnimalScreen } from "./screens/AnimalScreen";
import { Board } from "./screens/Board";
import { ExportScreen } from "./screens/ExportScreen";
import { PrintView } from "./screens/PrintView";

function Screen() {
  const route = useRoute();
  switch (route.name) {
    case "animal":
      return <AnimalScreen key={route.id} id={route.id} />;
    case "add":
      return <AddAnimal />;
    case "export":
      return <ExportScreen />;
    case "print":
      return <PrintView key={route.id} id={route.id} />;
    case "board":
      return <Board />;
  }
}

export default function App() {
  return (
    <AuthGate>
      <div className="min-h-svh bg-paper print:bg-white">
        <div className="mx-auto max-w-xl px-4 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-baseline justify-between no-print">
            <a href="#/" className="font-serif text-2xl text-ink">
              Barn Book
            </a>
            <span>
              <a
                href="#/export"
                className="inline-block min-h-11 px-2 pt-2.5 text-sm text-soft underline underline-offset-2"
              >
                Export
              </a>
              <button
                onClick={signOut}
                className="min-h-11 px-2 text-sm text-soft underline underline-offset-2"
              >
                Sign out
              </button>
            </span>
          </div>
          <Screen />
        </div>
      </div>
    </AuthGate>
  );
}
