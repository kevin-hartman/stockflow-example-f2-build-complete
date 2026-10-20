import { useCallback, useEffect, useState } from "react";
import { listLocations } from "../api/stock";

/** Every distinct location on record; `reload` re-queries after a filing adds one. */
export function useLocations() {
  const [locations, setLocations] = useState<string[]>([]);
  const reload = useCallback(() => {
    listLocations()
      .then(setLocations)
      .catch(() => setLocations([]));
  }, []);
  useEffect(reload, [reload]);
  return { locations, reload };
}
