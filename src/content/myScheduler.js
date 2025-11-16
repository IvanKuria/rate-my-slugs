import React from "react";
import { createRoot } from "react-dom/client";
import ShowProfInfo from "../components/ShowProfInfo.jsx"

async function printContent() {
    const data = await loadJsonData()
    const table = document.querySelector('table')
    const bodies = table.querySelectorAll('tbody')

    bodies.forEach((body, index) => {
        const profName = body.querySelectorAll('span')[9]?.textContent;
        
        if (data && profName) {
            if (profName in data) {
                console.log(`Prof UID: ${data[profName]}`)
                
                // Create a mount point for the button right after the table row
                const mount = document.createElement("div");
                mount.className = "prof-card";
                
                // Insert the button container right after this tbody element
                body.parentNode.insertBefore(mount, body.nextSibling);
                
                // Create React root and render the button component
                const root = createRoot(mount);
                root.render(
                    <React.StrictMode>
                        <ShowProfInfo professorName={profName} professorUID={data[profName]} />
                    </React.StrictMode>
                );
            } else {
                console.log(`No UID found for professor: ${profName}`);
            }
        }
    });
}

// In a background script or content script
async function loadJsonData() {
    try {
        const jsonUrl = chrome.runtime.getURL('data/name-uid.json');
        const response = await fetch(jsonUrl);
        const data = await response.json();

        return data;
    } catch (error) {
        console.error("Error loading JSON:", error);
        return null;
    }
}

setTimeout(printContent, 1500)