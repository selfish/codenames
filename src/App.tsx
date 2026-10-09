import { useSyncExternalStore } from "react";
import MapCard from "./components/map-card";

function subscribeToLocation(onChange: () => void) {
    window.addEventListener("popstate", onChange);
    window.addEventListener("hashchange", onChange);
    return () => {
        window.removeEventListener("popstate", onChange);
        window.removeEventListener("hashchange", onChange);
    };
}

function isRootHash() {
    // Preserve the former single hash route, including query/fragment suffixes.
    // Encoded slashes and non-root paths did not match that route.
    const pathname = window.location.hash.slice(1).split(/[?#]/, 1)[0];
    return /^\/*$/.test(pathname);
}

export default function App() {
    const isRoot = useSyncExternalStore(subscribeToLocation, isRootHash);
    if (isRoot) return <MapCard />;

    // Keep the existing production fallback for unsupported hash paths.
    return <>
        <h2>Unexpected Application Error!</h2>
        <h3 style={{ fontStyle: "italic" }}>404 Not Found</h3>
    </>;
}
