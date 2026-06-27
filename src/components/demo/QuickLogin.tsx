// src/components/demo/QuickLogin.tsx
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

const DEMO_ACCOUNTS = [
  { role: 'Customer', email: 'demo.customer@gridsecurity.com', password: 'Demo@123', color: 'bg-blue-500' },
  { role: 'Technician', email: 'demo.technician@gridsecurity.com', password: 'Demo@123', color: 'bg-green-500' },
  { role: 'Guard', email: 'demo.guard@gridsecurity.com', password: 'Demo@123', color: 'bg-orange-500' },
  { role: 'Partner', email: 'demo.partner@gridsecurity.com', password: 'Demo@123', color: 'bg-purple-500' },
  { role: 'Admin', email: 'demo.admin@gridsecurity.com', password: 'Demo@123', color: 'bg-red-500' },
  { role: 'Sales', email: 'demo.sales@gridsecurity.com', password: 'Demo@123', color: 'bg-yellow-500' },
];

export function QuickLogin() {
  const { signIn } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleQuickLogin = async (email: string, password: string, role: string) => {
    setLoading(role);
    try {
      await signIn(email, password);
    } catch (error) {
      console.error('Quick login failed:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {DEMO_ACCOUNTS.map((account) => (
        <Button
          key={account.role}
          variant="outline"
          size="sm"
          loading={loading === account.role}
          onClick={() => handleQuickLogin(account.email, account.password, account.role)}
          className="bg-neutral-800/50 border-neutral-700 text-xs hover:bg-neutral-700"
        >
          <span className={`w-2 h-2 rounded-full ${account.color} mr-2`} />
          {account.role}
        </Button>
      ))}
    </div>
  );
}