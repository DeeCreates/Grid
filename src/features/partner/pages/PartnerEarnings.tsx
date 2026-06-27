// src/features/partner/pages/PartnerEarnings.tsx
import { Card, CardContent } from '@/components/ui/Card';
import { Currency } from '@/components/ui/Currency';
import { DollarSign, TrendingUp, Clock } from 'lucide-react';

export function PartnerEarnings() {
  const stats = [
    { title: 'Total Earnings', value: 3450, icon: DollarSign, color: 'text-green-600' },
    { title: 'This Month', value: 850, icon: TrendingUp, color: 'text-blue-600' },
    { title: 'Pending', value: 250, icon: Clock, color: 'text-yellow-600' },
  ];

  const transactions = [
    { id: 1, customer: 'John Mensah', amount: 299, date: '2024-01-20', status: 'paid' },
    { id: 2, customer: 'Esi Boateng', amount: 499, date: '2024-01-15', status: 'pending' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">My Earnings</h1>
      
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-xl font-bold"><Currency amount={stat.value} /></p>
                </div>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr><th className="p-3 text-left">Customer</th><th className="p-3 text-left">Amount</th><th className="p-3 text-left">Date</th><th className="p-3 text-left">Status</th></tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-b">
                  <td className="p-3">{t.customer}</td>
                  <td className="p-3"><Currency amount={t.amount} /></td>
                  <td className="p-3">{t.date}</td>
                  <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${t.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}