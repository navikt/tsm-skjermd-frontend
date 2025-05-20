import { useState } from "react";


export const SecretForm = () => {
    //const [issueId, setIssueId] = useState<string>("fake-issue-id");
    const [info, setInfo] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

    const issueId = "fake-issue-id"; // Simulert issueId for testing

    // Bare eksempel på hvordan en kan gjøre det.
    const handleSave = async () => {
        // Simulerer en issueId fra URL eller annen kilde
        if (!issueId || !info.trim()) return;
        setStatus("success");
        return;
        setStatus("saving");

        try {
            const res = await fetch("http://localhost:8000/api/v1/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ issueId, info }),
            });

            if (!res.ok) throw new Error("Server error");

            await res.json();
            setStatus("success");
            setInfo("");
        } catch (err) {
            console.error("Error saving info:", err);
            setStatus("error");
        }
    };

    return (
        <div className="p-4 bg-white rounded shadow max-w-md space-y-4">
            <h3 className="text-lg font-bold">Skjermingsverdig informasjon</h3>

            <textarea
                className="w-full p-2 border rounded"
                rows={5}
                value={info}
                onChange={(e) => setInfo(e.target.value)}
                placeholder="Skriv sensitiv info her..."
            />

            <button
                onClick={handleSave}
                disabled={status === "saving" || !info.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {status === "saving" ? "Lagrer..." : "Lagre"}
            </button>

            <p className="text-sm">
                {status === "success" && "Lagret ✅"}
                {status === "error" && "Feil ved lagring ❌"}
            </p>
        </div>
    );
};