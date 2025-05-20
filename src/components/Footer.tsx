import { BodyShort } from "@navikt/ds-react";

export const Footer = () => {
    return (
        <footer className="bg-gray-100 text-center py-4 mt-auto text-text-subtle">
            <BodyShort size="small">
                &copy; {new Date().getFullYear()} NAV – Jira-integrasjon
            </BodyShort>
        </footer>
    );
};