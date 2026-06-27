import type { RealtimeUnsubscribe } from "./types";

export interface RealtimeProvider {
  subscribeTable(
    table: string,
    onChange: (event: "INSERT" | "UPDATE" | "DELETE", row: unknown) => void,
    filter?: { column: string; value: string },
  ): RealtimeUnsubscribe;
}
