import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Eye, Download, CheckCircle2, Clock, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';

export default function PayslipList({ household }) {
  const { t, language } = useLanguage();
  const [payslips, setPayslips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isApprovingId, setIsApprovingId] = useState(null);

  useEffect(() => {
    loadPayslips();
  }, [household, statusFilter]);

  const loadPayslips = async () => {
    setIsLoading(true);
    try {
      let query = { household_id: household.id };
      if (statusFilter !== 'all') {
        query.status = statusFilter;
      }
      const data = await base44.entities.Payslip.filter(query, '-period_end');
      setPayslips(data);
    } catch (error) {
      console.error('Failed to load payslips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovePayslip = async (payslipId) => {
    setIsApprovingId(payslipId);
    try {
      const user = await base44.auth.me();
      await base44.entities.Payslip.update(payslipId, {
        status: 'approved',
        approved_by: user.email,
        approved_date: new Date().toISOString()
      });
      loadPayslips();
    } catch (error) {
      console.error('Failed to approve payslip:', error);
      alert(t('payroll.approvalError'));
    } finally {
      setIsApprovingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      approved: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{t(`payroll.status.${status}`)}</Badge>;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
      case 'draft':
        return <Clock className="w-4 h-4 text-gray-600" />;
      case 'paid':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium">{t('payroll.filterByStatus')}</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('payroll.allStatuses')}</SelectItem>
              <SelectItem value="draft">{t('payroll.status.draft')}</SelectItem>
              <SelectItem value="approved">{t('payroll.status.approved')}</SelectItem>
              <SelectItem value="paid">{t('payroll.status.paid')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Payslip Cards */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : payslips.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          {t('payroll.noPayslips')}
        </Card>
      ) : (
        <div className="space-y-3">
          {payslips.map((payslip) => (
            <Card key={payslip.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(payslip.status)}
                    <div>
                      <p className="font-semibold">{payslip.staff_name}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(payslip.period_start), 'MMM d')} - {format(new Date(payslip.period_end), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right mr-4">
                  <p className="font-bold text-lg">
                    {payslip.currency}
                    {payslip.net_salary.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">{t('payroll.netSalary')}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(payslip.status)}
                </div>
              </div>

              {/* Summary Row */}
              <div className="mt-3 pt-3 border-t text-xs text-gray-600 flex gap-6">
                <span>{payslip.total_hours}h @ {payslip.currency}{payslip.hourly_rate}</span>
                <span>{t('payroll.gross')}: {payslip.currency}{payslip.gross_salary.toFixed(2)}</span>
                {payslip.total_deductions > 0 && (
                  <span>{t('payroll.deductions')}: {payslip.currency}{payslip.total_deductions.toFixed(2)}</span>
                )}
              </div>

              {/* Actions */}
              <div className="mt-3 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedPayslip(payslip);
                    setIsDetailOpen(true);
                  }}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {t('common.view')}
                </Button>
                {payslip.status === 'draft' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApprovePayslip(payslip.id)}
                    disabled={isApprovingId === payslip.id}
                  >
                    {isApprovingId === payslip.id && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                    {t('payroll.approve')}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedPayslip && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('payroll.payslipDetails')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Header */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <p className="text-sm text-gray-600">{t('payroll.staffMember')}</p>
                  <p className="font-semibold">{selectedPayslip.staff_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('payroll.period')}</p>
                  <p className="font-semibold">
                    {format(new Date(selectedPayslip.period_start), 'MMM d, yyyy')} - {format(new Date(selectedPayslip.period_end), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              {/* Earnings */}
              <div className="space-y-2">
                <h3 className="font-semibold">{t('payroll.earnings')}</h3>
                <div className="flex justify-between">
                  <span>{t('payroll.hours')}</span>
                  <span>{selectedPayslip.total_hours}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('payroll.hourlyRate')}</span>
                  <span>{selectedPayslip.currency}{selectedPayslip.hourly_rate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>{t('payroll.grossSalary')}</span>
                  <span>{selectedPayslip.currency}{selectedPayslip.gross_salary.toFixed(2)}</span>
                </div>
              </div>

              {/* Deductions */}
              {selectedPayslip.deductions && selectedPayslip.deductions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">{t('payroll.deductions')}</h3>
                  {selectedPayslip.deductions.map((ded, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{language === 'English' ? ded.deduction_type : ded.deduction_type_hebrew}</span>
                      <span>-{selectedPayslip.currency}{ded.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>{t('payroll.totalDeductions')}</span>
                    <span>-{selectedPayslip.currency}{selectedPayslip.total_deductions.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Net Salary */}
              <div className="bg-green-50 p-4 rounded flex justify-between items-center text-lg font-bold">
                <span>{t('payroll.netSalary')}</span>
                <span className="text-green-700">{selectedPayslip.currency}{selectedPayslip.net_salary.toFixed(2)}</span>
              </div>

              {/* Status */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{t('payroll.status.label')}</span>
                {getStatusBadge(selectedPayslip.status)}
              </div>

              {selectedPayslip.approved_by && (
                <p className="text-xs text-gray-500">
                  {t('payroll.approvedBy')} {selectedPayslip.approved_by}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setIsDetailOpen(false)}>{t('common.close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}