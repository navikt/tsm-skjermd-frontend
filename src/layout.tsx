import type { ReactNode } from "react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";

type Props = {
    children: ReactNode;
    title?: string;
};

export const AppLayout = ({ children, title = "Jira Widget" }: Props) => {
    return (
        <div className="min-h-screen flex flex-col">
            <Header title={title} userName={"userName"} />

            {/* Main-innhold sentrert */}
            <main className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="w-full max-w-2xl p-6">{children}</div>
            </main>

            <Footer />
        </div>
    );
};