import { BodyShort, Detail, HStack } from "@navikt/ds-react";
import { ShieldLockIcon } from "@navikt/aksel-icons";

export const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <HStack justify="space-between" align="center" wrap gap="4">
          <HStack gap="2" align="center" className="text-gray-500">
            <ShieldLockIcon aria-hidden />
            <BodyShort size="small">
              Skjermd - Sikker lagring av sensitiv informasjon
            </BodyShort>
          </HStack>
          <Detail className="text-gray-400">
            NAV IT &copy; {new Date().getFullYear()}
          </Detail>
        </HStack>
      </div>
    </footer>
  );
};
