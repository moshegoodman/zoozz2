import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Users, DollarSign, FileText } from 'lucide-react';
import { useLanguage } from '../components/i18n/LanguageContext';
import PayslipGenerator from '../components/payroll/PayslipGenerator';
import PayslipList from '../components/payroll/PayslipList';
import DeductionTypeManager from '../components/payroll/DeductionTypeManager';

export default function PayrollPage() {
  const { t, language } = useLanguage();
  const [user, setUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('payslips');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.user_type === 'admin') {
        // Admin can see all households
        const allHouseholds = await base44.entities.Household.list();
        setHouseholds(allHouseholds);
        if (allHouseholds.length > 0) {
          setSelectedHousehold(allHouseholds[0]);
        }
      } else if (currentUser.user_type === 'chief of staff') {
        // Chief of staff can see their households
        const allHouseholds = await base44.entities.Household.list();
        setHouseholds(allHouseholds);
        if (allHouseholds.length > 0) {
          setSelectedHousehold(allHouseholds[0]);
        }
      }
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('payroll.title')}</h1>
        <p className="text-gray-600">{t('payroll.description')}</p>
      </div>

      {/* Household Selector */}
      {households.length > 0 && (
        <div className="mb-6 flex gap-4 items-end">
          <div className="flex-1 max-w-xs">
            <label className="text-sm font-medium mb-2 block">{t('payroll.selectHousehold')}</label>
            <Select
              value={selectedHousehold?.id || ''}
              onValueChange={(value) => {
                const household = households.find(h => h.id === value);
                setSelectedHousehold(household);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {households.map(household => (
                  <SelectItem key={household.id} value={household.id}>
                    {language === 'English' ? household.name : (household.name_hebrew || household.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {selectedHousehold && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t('payroll.staffCount')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">-</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  {t('payroll.monthlyPayroll')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">-</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t('payroll.totalPayslips')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">-</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="payslips">{t('payroll.payslips')}</TabsTrigger>
              <TabsTrigger value="deductions">{t('payroll.deductionTypes')}</TabsTrigger>
            </TabsList>

            <TabsContent value="payslips" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">{t('payroll.payslipManagement')}</h2>
                <PayslipGenerator
                  household={selectedHousehold}
                  onPayslipsCreated={() => loadData()}
                />
              </div>
              <PayslipList household={selectedHousehold} />
            </TabsContent>

            <TabsContent value="deductions">
              <DeductionTypeManager />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}