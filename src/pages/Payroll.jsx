import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Users, DollarSign, FileText } from 'lucide-react';
import { useLanguage } from '../components/i18n/LanguageContext';
import DeductionTypeManager from '@/components/payroll/DeductionTypeManager';
import SeasonPayrollTable from '@/components/payroll/SeasonPayrollTable';

export default function PayrollPage() {
  const { t, language } = useLanguage();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('payroll');
  const [season, setSeason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to load payroll data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user || (user.user_type !== 'admin' && user.user_type !== 'chief of staff')) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Card className="p-8 text-center text-gray-500">
          {t('payroll.accessDenied')}
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-full mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-500 text-sm">Season payroll — hours auto-calculated from Time Logs</p>
        </div>
        {/* Season filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Season:</label>
          <input
            value={season}
            onChange={e => setSeason(e.target.value)}
            placeholder="e.g. SU24"
            className="border rounded px-2 py-1 text-sm w-28"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="deductions">Deduction Types</TabsTrigger>
        </TabsList>

        <TabsContent value="payroll">
          <SeasonPayrollTable season={season || undefined} />
        </TabsContent>

        <TabsContent value="deductions">
          <DeductionTypeManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}