import { useParams } from "react-router-dom";
import { SensureringEditor } from "../components/SensureringEditor";

export const SensureringIframe = () => {
  const { sakId } = useParams<{ sakId: string }>();

  if (!sakId) {
    return <p>Mangler sakId</p>;
  }

  return (
    <div className="p-4">
      <SensureringEditor
        sakId={sakId}
        autoSave
      />
    </div>
  );
};
