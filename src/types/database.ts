export interface Violation {
  id: string;
  vehicle_number: string;
  violation_type: string;
  fine_amount: number;
  status: 'Pending' | 'Paid';
  created_at: string;
  evidence_url?: string;
  speed?: number;
  location: string;
  metadata: Record<string, any>;
}
