export const formatDato = (dato: string | null): string => {
  if (!dato) return "-";
  return new Date(dato).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export const formatTid = (dato: string | null): string => {
  if (!dato) return "";
  return new Date(dato).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const tekstTilJira = (tekst: string): string => {
  if (tekst.length === 0) return "[Maskert]";
  if ([...tekst].every((c) => c === "*")) return "[Maskert]";
  return tekst;
};
