import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { createHashRouter, RouterProvider, } from "react-router-dom";
import MapCard from "./components/map-card";
import reportWebVitals from "./reportWebVitals";

const router = createHashRouter([
    { path: "/", element: <MapCard/> },
]);

const rootElement = document.getElementById("root");
if (rootElement) {


    const root = ReactDOM.createRoot(rootElement);

    root.render(
        <React.StrictMode>
            <div className="font-sans h-screen overflow-y-scroll">
                <RouterProvider router={router}/>
            </div>
        </React.StrictMode>
    );

    reportWebVitals();
}