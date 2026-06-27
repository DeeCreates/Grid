// src/features/partner/pages/PartnerDashboard.tsx
import { useState } from 'react';
import {
  Users, TrendingUp, DollarSign, Gift, 
  Share2, Link, Copy, CheckCircle, Download,
  Calendar, BarChart3, Award, Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Currency } from '@/components/ui/Currency';
import { DataTable } from '@/components/ui/DataTable';

interface Lead {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  date: Date;
  status: 'new' | 'contacted' | 'converted' | 'lost';
  commission: number | null;
}

interface Commission {
  id: string;
  leadId: string;
  amount: number;
  status: 'pending' | 'paid';
  date: Date;
}

export function PartnerDashboard() {
  const [partnerInfo] = useState({
    name: 'Security Solutions GH',
    joinDate: new Date(2023, 6, 1),
    totalEarnings: 3450,
    pendingEarnings: 850,
    referralCode: 'GRID-PARTNER-001',
    referralLink: 'https://gridsecurity.com/ref/GRID-PARTNER-001',
    tier: 'Gold Partner',
    conversionRate: 32,
  });

  const [leads, setLeads] = useState<Lead[]>([
    { id: 'LEAD-001', customerName: 'John Mensah', email: 'john@example.com', phone: '+233 24 123 4567', date: new Date(2024, 0, 10), status: 'converted', commission: 299 },
    { id: 'LEAD-002', customerName: 'Ama Serwaa', email: 'ama@example.com', phone: '+233 20 987 6543', date: new Date(2024, 0, 12), status: 'contacted', commission: null },
    { id: 'LEAD-003', customerName: 'Kofi Asare', email: 'kofi@example.com', phone: '+233 54 456 7890', date: new Date(2024, 0, 8), status: 'new', commission: null },
    { id: 'LEAD-004', customerName: 'Esi Boateng', email: 'esi@example.com', phone: '+233 24 987 6543', date: new Date(2024, 0, 5), status: 'converted', commission: 499 },
  ]);

  const [commissions, setCommissions] = useState<Commission[]>([
    { id: 'COMM-001', leadId: 'LEAD-001', amount: 299, status: 'paid', date: new Date(2024, 0, 20) },
    { id: 'COMM-002', leadId: 'LEAD-004', amount: 499, status: 'pending', date: new Date(2024, 0, 22) },
  ]);

  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(partnerInfo.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(partnerInfo.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leadColumns = [
    { key: 'customerName', header: 'Customer' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { 
      key: 'date', 
      header: 'Date',
      render: (value: Date) => value.toLocaleDateString()
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          value === 'converted' ? 'bg-green-100 text-green-800' :
          value === 'contacted' ? 'bg-blue-100 text-blue-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {value}
        </span>
      )
    },
    { 
      key: 'commission', 
      header: 'Commission',
      render: (value: number | null) => value ? <Currency amount={value} /> : '-'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partner Dashboard</h1>
        <p className="text-gray-600 mt-1">Track your referrals, leads, and earnings</p>
      </div>

      {/* Partner Tier Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl p-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-6 h-6" />
              <span className="text-sm font-medium">{partnerInfo.tier}</span>
            </div>
            <h2 className="text-2xl font-bold">Welcome back, {partnerInfo.name}</h2>
            <p className="text-purple-100 mt-1">Partner since {partnerInfo.joinDate.toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-100">Conversion Rate</p>
            <p className="text-3xl font-bold">{partnerInfo.conversionRate}%</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900">
                  <Currency amount={partnerInfo.totalEarnings} />
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Earnings</p>
                <p className="text-2xl font-bold text-yellow-600">
                  <Currency amount={partnerInfo.pendingEarnings} />
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Leads</p>
                <p className="text-2xl font-bold text-gray-900">{leads.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Conversions</p>
                <p className="text-2xl font-bold text-green-600">
                  {leads.filter(l => l.status === 'converted').length}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Section */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">Share this code with customers</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-white border rounded-lg px-3 py-2 font-mono text-sm">
                  {partnerInfo.referralCode}
                </code>
                <Button variant="outline" onClick={handleCopyCode}>
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">Share this link anywhere</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-white border rounded-lg px-3 py-2 font-mono text-sm truncate">
                  {partnerInfo.referralLink}
                </code>
                <Button variant="outline" onClick={handleCopyLink}>
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copy Link
                </Button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline">
                <Share2 className="w-4 h-4 mr-2" />
                Share on WhatsApp
              </Button>
              <Button variant="outline">
                <Mail className="w-4 h-4 mr-2" />
                Share via Email
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <p className="text-sm text-gray-500">Basic Plan</p>
              <p className="text-lg font-bold text-blue-600">10% Commission</p>
            </div>
            <div className="text-center p-3 border rounded-lg bg-blue-50 border-blue-200">
              <p className="text-sm text-gray-500">Professional Plan</p>
              <p className="text-lg font-bold text-blue-600">15% Commission</p>
              <span className="text-xs text-green-600">Most Popular</span>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-sm text-gray-500">Enterprise Plan</p>
              <p className="text-lg font-bold text-blue-600">20% Commission</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable data={leads} columns={leadColumns} searchable searchKey="customerName" />
        </CardContent>
      </Card>

      {/* Commissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {commissions.map((comm) => (
              <div key={comm.id} className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Commission #{comm.id}</p>
                  <p className="text-sm text-gray-500">{comm.date.toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">
                    <Currency amount={comm.amount} />
                  </p>
                  <span className={`text-xs ${comm.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {comm.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-right">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download Statement
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}