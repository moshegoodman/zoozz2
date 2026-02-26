import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Save, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';

export default function PayslipGenerator({ household, onPayslipsCreated }) {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [payrollData, setPayrollData] = useState([]);
  const [deductionTypes, setDeductionTypes] = useState([]);
  const [selectedDeductions, setSelectedDeductions] = useState({});

  useEffect(() => {
    loadDeductionTypes();
  }, []);

  const loadDeductionTypes = async () => {
    try {
      const types = await base44.entities.DeductionType.filter({ is_active: true });
      setDeductionTypes(types);
    } catch (error) {
      console.error('Failed to load deduction types:', error);
    }
  };

  const handleCalculatePayroll = async () => {
    if (!periodStart || !periodEnd) {
      alert(t('payroll.selectPeriod'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('calculatePayroll', {
        household_id: household.id,
        period_start: periodStart,
        period_end: periodEnd
      });
      setPayrollData(response.payrollData || []);
    } catch (error) {
      console.error('Payroll calculation failed:', error);
      alert(t('payroll.calculationError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDeduction = (staffId, deductionCode) => {
    setSelectedDeductions(prev => {
      const key = `${staffId}-${deductionCode}`;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const handleCreatePayslips = async () => {
    if (payrollData.length === 0) {
      alert(t('payroll.noDataToCreate'));
      return;
    }

    setIsLoading(true);
    try {
      const payslips = payrollData.map(data => {
        const deductions = [];
        let totalDeductions = 0;

        deductionTypes.forEach(type => {
          const key = `${data.staff_user_id}-${type.code}`;
          if (selectedDeductions[key]) {
            let deductionAmount = 0;
            if (type.deduction_method === 'percentage' && type.default_percentage) {
              deductionAmount = (data.gross_salary * type.default_percentage) / 100;
            } else if (type.deduction_method === 'fixed_amount' && type.default_amount) {
              deductionAmount = type.default_amount;
            }

            if (deductionAmount > 0) {
              deductions.push({
                deduction_type: type.name,
                deduction_type_hebrew: type.name_hebrew,
                amount: deductionAmount,
                percentage: type.default_percentage
              });
              totalDeductions += deductionAmount;
            }
          }
        });

        return {
          ...data,
          household_name: household.name,
          household_name_hebrew: household.name_hebrew,
          deductions,
          total_deductions: totalDeductions,
          net_salary: data.gross_salary - totalDeductions,
          status: 'draft'
        };
      });

      await base44.entities.Payslip.bulkCreate(payslips);
      alert(t('payroll.payslipsCreated'));
      if (onPayslipsCreated) onPayslipsCreated();
      setIsOpen(false);
      setPayrollData([]);
      setPeriodStart('');
      setPeriodEnd('');
    } catch (error) {
      console.error('Failed to create payslips:', error);
      alert(t('payroll.creationError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetCurrentMonth = () => {
    const now = new Date();
    setPeriodStart(format(startOfMonth(now), 'yyyy-MM-dd'));
    setPeriodEnd(format(endOfMonth(now), 'yyyy-MM-dd'));
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="bg-blue-600 hover:bg-blue-700">
        <Plus className="w-4 h-4 mr-2" />
        {t('payroll.generatePayslips')}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('payroll.generatePayslips')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Period Selection */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('payroll.periodStart')}</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('payroll.periodEnd')}</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={handleSetCurrentMonth} className="w-full">
                  <Calendar className="w-4 h-4 mr-2" />
                  {t('payroll.thisMonth')}
                </Button>
              </div>
            </div>

            {/* Calculate Button */}
            <Button
              onClick={handleCalculatePayroll}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('payroll.calculatePayroll')}
            </Button>

            {/* Payroll Data Display */}
            {payrollData.length > 0 && (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {payrollData.map((data) => (
                  <Card key={data.staff_user_id} className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-semibold">{data.staff_name}</p>
                        <p className="text-xs text-gray-500">{data.total_hours}h @ ₪{data.hourly_rate}/h</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">₪{data.gross_salary.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{t('payroll.grossSalary')}</p>
                      </div>
                    </div>

                    {/* Deduction Checkboxes */}
                    <div className="border-t pt-2 space-y-2">
                      {deductionTypes.map((type) => (
                        <div key={type.code} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${data.staff_user_id}-${type.code}`}
                            checked={selectedDeductions[`${data.staff_user_id}-${type.code}`] || false}
                            onCheckedChange={() =>
                              handleToggleDeduction(data.staff_user_id, type.code)
                            }
                          />
                          <label
                            htmlFor={`${data.staff_user_id}-${type.code}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {language === 'English' ? type.name : type.name_hebrew}
                          </label>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreatePayslips}
              disabled={isLoading || payrollData.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('payroll.createPayslips')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}