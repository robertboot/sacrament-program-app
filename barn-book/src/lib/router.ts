import { useEffect, useState } from "react";

export type Route =
  | { name: "board" }
  | { name: "animal"; id: string }
  | { name: "add" }
  | { name: "export" }
  | { name: "print"; id: string };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "animal" && parts[1]) return { name: "animal", id: parts[1] };
  if (parts[0] === "add") return { name: "add" };
  if (parts[0] === "export") return { name: "export" };
  if (parts[0] === "print" && parts[1]) return { name: "print", id: parts[1] };
  return { name: "board" };
}

export function routeHash(r: Route): string {
  switch (r.name) {
    case "board":
      return "#/";
    case "animal":
      return `#/animal/${r.id}`;
    case "add":
      return "#/add";
    case "export":
      return "#/export";
    case "print":
      return `#/print/${r.id}`;
  }
}

export function navigate(r: Route) {
  window.location.hash = routeHash(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
