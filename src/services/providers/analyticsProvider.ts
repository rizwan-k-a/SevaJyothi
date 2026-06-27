export interface AnalyticsProvider {
  stats(): Promise<unknown>;
  hotspots(minIncidents?: number): Promise<
    Array<{
      lat: number;
      lng: number;
      incidents: number;
      total_priority: number;
      dominant_category: string;
    }>
  >;
}
