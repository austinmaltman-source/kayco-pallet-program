export interface PalletHistory {
  id: string;
  name: string;
  date: string;
  skuCount: number;
  status: "delivered" | "in-transit" | "pending" | "completed";
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  status: "Priority" | "Standard" | "Urgent" | "Inactive";
}

export interface CustomerSummary extends Customer {
  builds: number;
  history: string | null;
  historyNote: string | null;
}
