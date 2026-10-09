import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

const rootElement = document.getElementById("root");
if (rootElement) {


    const root = ReactDOM.createRoot(rootElement);

    root.render(
        <React.StrictMode>
            <div className="font-sans h-screen overflow-y-scroll">
                <App />
            </div>
        </React.StrictMode>
    );

    reportWebVitals();
}
