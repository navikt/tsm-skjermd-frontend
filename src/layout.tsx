import { type ReactNode, useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { userApi } from "./api/sakApi";
import type { UserInfo } from "./api/types";
import { createLogger } from "./logger";

const log = createLogger("Layout");

type Props = {
  children: ReactNode;
};

export const AppLayout = ({ children }: Props) => {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    userApi.hentBruker()
      .then(setUser)
      .catch((err) => log.error("Kunne ikke hente bruker", err));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header userName={user?.navIdent} />

      <main className="flex-1 py-8">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
};
