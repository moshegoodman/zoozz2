import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Edit2, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function DeductionTypeManager() {
  const { t, language } = useLanguage();
  const [deductionTypes, setDeductionTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    name_hebrew: '',
    code: '',
    deduction_method: 'manual',
    default_amount: '',
    default_percentage: '',
    is_mandatory: false,
    is_active: true
  });

  useEffect(() => {
    loadDeductionTypes();
  }, []);

  const loadDeductionTypes = async () => {
    setIsLoading(true);
    try {
      const types = await base44.entities.DeductionType.list();
      setDeductionTypes(types);
    } catch (error) {
      console.error('Failed to load deduction types:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = (deductionType = null) => {
    if (deductionType) {
      setEditingId(deductionType.id);
      setIsEditing(true);
      setFormData({
        name: deductionType.name,
        name_hebrew: deductionType.name_hebrew,
        code: deductionType.code,
        deduction_method: deductionType.deduction_method || 'manual',
        default_amount: deductionType.default_amount || '',
        default_percentage: deductionType.default_percentage || '',
        is_mandatory: deductionType.is_mandatory || false,
        is_active: deductionType.is_active !== false
      });
    } else {
      setIsEditing(false);
      setEditingId(null);
      setFormData({
        name: '',
        name_hebrew: '',
        code: '',
        deduction_method: 'manual',
        default_amount: '',
        default_percentage: '',
        is_mandatory: false,
        is_active: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.name_hebrew || !formData.code) {
      alert(t('payroll.fillRequiredFields'));
      return;
    }

    setIsLoading(true);
    try {
      const data = {
        name: formData.name,
        name_hebrew: formData.name_hebrew,
        code: formData.code,
        deduction_method: formData.deduction_method,
        default_amount: formData.default_amount ? parseFloat(formData.default_amount) : null,
        default_percentage: formData.default_percentage ? parseFloat(formData.default_percentage) : null,
        is_mandatory: formData.is_mandatory,
        is_active: formData.is_active
      };

      if (isEditing) {
        await base44.entities.DeductionType.update(editingId, data);
      } else {
        await base44.entities.DeductionType.create(data);
      }

      loadDeductionTypes();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save deduction type:', error);
      alert(t('payroll.saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm(t('payroll.confirmDelete'))) {
      try {
        await base44.entities.DeductionType.delete(id);
        loadDeductionTypes();
      } catch (error) {
        console.error('Failed to delete deduction type:', error);
        alert(t('payroll.deleteFailed'));
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{t('payroll.manageDeductions')}</h2>
        <Button onClick={() => openDialog()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          {t('payroll.addDeductionType')}
        </Button>
      </div>

      {isLoading && deductionTypes.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : deductionTypes.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          {t('payroll.noDeductionTypes')}
        </Card>
      ) : (
        <div className="grid gap-4">
          {deductionTypes.map((type) => (
            <Card key={type.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{type.name}</h3>
                    <p className="text-sm text-gray-600">{type.name_hebrew}</p>
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      <p>{t('payroll.code')}: {type.code}</p>
                      <p>{t('payroll.method')}: {t(`payroll.method.${type.deduction_method}`)}</p>
                      {type.deduction_method === 'fixed_amount' && type.default_amount && (
                        <p>{t('payroll.amount')}: ₪{type.default_amount}</p>
                      )}
                      {type.deduction_method === 'percentage' && type.default_percentage && (
                        <p>{t('payroll.percentage')}: {type.default_percentage}%</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDialog(type)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(type.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t('payroll.editDeductionType') : t('payroll.addDeductionType')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('payroll.nameEnglish')}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label>{t('payroll.nameHebrew')}</Label>
              <Input
                value={formData.name_hebrew}
                onChange={(e) => setFormData({ ...formData, name_hebrew: e.target.value })}
              />
            </div>

            <div>
              <Label>{t('payroll.code')}</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., income_tax"
                disabled={isEditing}
              />
            </div>

            <div>
              <Label>{t('payroll.method')}</Label>
              <Select
                value={formData.deduction_method}
                onValueChange={(value) => setFormData({ ...formData, deduction_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">{t('payroll.method.manual')}</SelectItem>
                  <SelectItem value="fixed_amount">{t('payroll.method.fixed_amount')}</SelectItem>
                  <SelectItem value="percentage">{t('payroll.method.percentage')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.deduction_method === 'fixed_amount' && (
              <div>
                <Label>{t('payroll.defaultAmount')}</Label>
                <Input
                  type="number"
                  value={formData.default_amount}
                  onChange={(e) => setFormData({ ...formData, default_amount: e.target.value })}
                  step="0.01"
                />
              </div>
            )}

            {formData.deduction_method === 'percentage' && (
              <div>
                <Label>{t('payroll.defaultPercentage')} (%)</Label>
                <Input
                  type="number"
                  value={formData.default_percentage}
                  onChange={(e) => setFormData({ ...formData, default_percentage: e.target.value })}
                  step="0.1"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="mandatory"
                checked={formData.is_mandatory}
                onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked })}
              />
              <Label htmlFor="mandatory" className="font-normal">
                {t('payroll.mandatory')}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="active" className="font-normal">
                {t('payroll.isActive')}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}