// src/features/partner/pages/PartnerLeads.tsx
import { DataTable } from '@/components/ui/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Currency } from '@/components/ui/Currency';

export function PartnerLeads() {
  const leads = [
    { id: 'LEAD-001', name: 'John Mensah', email: 'john@example.com', date: '2024-01-15', status: 'converted', commission: 299 },
    { id: 'LEAD-002', name: 'Ama Serwaa', email: 'ama@example.com', date: '2024-01-12', status: 'contacted', commission: null },
  ];

  const columns = [
    { key: 'name', header: 'Customer Name' },
    { key: 'email', header: 'Email' },
    { key: 'date', header: 'Date' },
    { key: 'status', header: 'Status' },
    { key: 'commission', header: 'Commission', render: (v: number | null) => v ? <Currency amount={v} /> : '-' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">My Referrals</h1>
      <Card>
        <CardContent className="p-0">
          <DataTable data={leads} columns={columns} />
        </CardContent>
      </Card>
    </div>
  );
}