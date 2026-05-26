import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Home, Edit, MapPin, FileVideo, Settings, ShoppingCart, Calendar,
  Store, Copy, Briefcase, Plus, Star, DollarSign, Trash2, User as UserIcon,
  ChevronDown, ChevronUp, Wand2
} from "lucide-react";

const jobRoles = ["chef", "sous chef", "cook", "householdManager", "waiter", "housekeeping", "other"];

export default function HouseholdCard({
  household, staff, ownerNames, kcsUsers, showStaffForm, setShowStaffForm,
  newStaffData, setNewStaffData,
  handleEditDetails, handleStartShopping, handleViewMealCalendar,
  handleEditAddress, handleEditInstructions, handleEditKashrutPreferences,
  handleEditVendorPreferences, handleEditStaffOrderableVendors,
  handleApplySeasonDefaultStores, hasSeasonDefaultStores,
  handleRemoveFromSeason,
  setCopyingHousehold, setCopyTargetSeason,
  handleAddStaff, handleToggleOrderPermission, handleUpdateStaffPrice,
  handleUpdatePaymentType, handleRemoveStaff, handleSetLead, handleOpenPayDialog,
  getStaffUserName, getKashrutOptionName,
  isRTL, t
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sanitize household name for use in selectors
  const householdSelector = household.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Get the lead vendor if it exists
  const leadVendor = household.staff_orderable_vendors && household.staff_orderable_vendors.length > 0 
    ? household.staff_orderable_vendors[0] 
    : null;

  return (
    <Card className="border" data-testid={`household-card-${householdSelector}`} id={`household-${householdSelector}`}>
      {/* Vendor name header */}
      {leadVendor && (
        <div className="px-6 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Store className="w-4 h-4 text-indigo-600" />
          {isRTL ? (leadVendor.vendor_name_hebrew || leadVendor.vendor_name) : leadVendor.vendor_name}
        </div>
      )}
      {/* Clickable header to expand/collapse */}
      <CardHeader
        className="pb-3 cursor-pointer select-none hover:bg-gray-50 transition-colors rounded-t-xl"
        onClick={() => setIsExpanded(v => !v)}
        data-testid={`household-header-${householdSelector}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <CardTitle className="text-lg truncate" data-testid={`household-name-${householdSelector}`}>{household.name}</CardTitle>
              <Button
                variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0"
                onClick={e => { e.stopPropagation(); handleEditDetails(household); }}
              >
                <Edit className="h-4 w-4 text-gray-500 hover:text-gray-800" />
              </Button>
            </div>
            {household.name_hebrew && (
              <p className="text-gray-600 ml-7" style={{ direction: 'rtl' }}>{household.name_hebrew}</p>
            )}
            <div className="flex items-center gap-2 ml-7 mt-1 flex-wrap">
              <span className="text-xs text-gray-500 font-medium">Hebrew: {household.name_hebrew || '—'}</span>
              <span className="text-xs text-gray-500 font-medium">ID: {household.id}</span>
            </div>
            <div className="flex items-center gap-2 ml-7 mt-1 flex-wrap">
              {household.household_code && (
                <Badge variant="secondary" className="text-sm">
                  Code: {(household.household_code || '')}
                </Badge>
              )}
              <Badge className={household.household_type === 'private' ? 'bg-orange-100 text-orange-800 text-xs' : 'bg-blue-100 text-blue-800 text-xs'}>
                {household.household_type === 'private' ? 'Private' : 'KCS'}
              </Badge>
              {household.season && (
                <Badge className="bg-amber-100 text-amber-800 text-xs">{household.season}</Badge>
              )}
              {/* Staff count mini-badge */}
              <span className="text-xs text-gray-400 ml-1">{staff.length} staff</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-1">
            {ownerNames.length > 0 && (
              <span className="text-xs text-gray-500 hidden sm:block max-w-[120px] truncate">{ownerNames[0]}</span>
            )}
            {isExpanded
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />
            }
          </div>
        </div>
      </CardHeader>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {/* Action buttons row */}
          <div className="px-6 pb-3 flex flex-wrap gap-2 border-b" onClick={e => e.stopPropagation()} data-testid={`household-actions-${householdSelector}`}>
            <Button variant="outline" size="sm" onClick={() => handleViewMealCalendar(household)} className="text-purple-600 border-purple-300 hover:bg-purple-50" data-testid={`btn-meal-calendar-${householdSelector}`}>
              <Calendar className="w-4 h-4 mr-1" />{t('admin.householdManagement.viewMealCalendar')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStartShopping(household)} className="bg-purple-50 text-purple-700 hover:bg-purple-100" data-testid={`btn-shop-${householdSelector}`}>
              <ShoppingCart className="w-4 h-4 mr-1" />{t('admin.householdManagement.shopForHousehold')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleEditAddress(household)}>
              <MapPin className="w-4 h-4 mr-1" />{t('admin.householdManagement.address')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleEditInstructions(household)}>
              <FileVideo className="w-4 h-4 mr-1" />{t('admin.householdManagement.instructions')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleEditKashrutPreferences(household)}>
              <Settings className="w-4 h-4 mr-1" />{t('admin.householdManagement.kashrut')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleEditVendorPreferences(household)}>
              <Settings className="w-4 h-4 mr-1" />Household Stores
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleEditStaffOrderableVendors(household)}>
              <Store className="w-4 h-4 mr-1" />{t('admin.householdManagement.staffStores')}
            </Button>
            {hasSeasonDefaultStores && handleApplySeasonDefaultStores && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplySeasonDefaultStores(household)}
                className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                title={`Apply default stores for season ${household.season || ''}`}
              >
                <Wand2 className="w-4 h-4 mr-1" />Apply Season Defaults
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { setCopyingHousehold(household); setCopyTargetSeason(""); }} className="text-green-600 border-green-300 hover:bg-green-50">
              <Copy className="w-4 h-4 mr-1" />Copy to Season
            </Button>
            {handleRemoveFromSeason && household.season && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemoveFromSeason(household)}
                className="text-red-600 border-red-300 hover:bg-red-50"
                title={`Remove this household from season ${household.season}`}
              >
                <Trash2 className="w-4 h-4 mr-1" />Remove from Season
              </Button>
            )}
          </div>

          <CardContent className="space-y-4 pt-4" data-testid={`household-content-${householdSelector}`}>
            {/* Owner Info */}
            <div className="flex items-center justify-between" data-testid={`household-owner-section-${householdSelector}`}>
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.owner')}:</span>
                <span className="text-sm">
                  {ownerNames.length > 0 ? ownerNames.join(', ') : <em className="text-gray-500">{t('admin.householdManagement.notAssigned')}</em>}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleEditDetails(household)} className="text-blue-600 hover:text-blue-800 p-1">
                <Edit className="w-4 h-4 mr-1" />{t('common.edit')}
              </Button>
            </div>

            {/* Address Info */}
            <div className="flex items-start gap-2" data-testid={`household-address-section-${householdSelector}`}>
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.address')}:</span>
                <p className="text-sm mt-1">
                  {(() => {
                    const parts = [household.street, household.building_number, household.household_number, household.neighborhood].filter(Boolean);
                    return parts.length > 0 ? parts.join(', ') : <em className="text-gray-500">{t('admin.householdManagement.noAddress')}</em>;
                  })()}
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="flex items-start gap-2" data-testid={`household-instructions-section-${householdSelector}`}>
              <FileVideo className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.instructions')}:</span>
                {household.instructions || household.instructions_video_url ? (
                  <div className="mt-1 space-y-2">
                    {household.instructions && <p className="text-sm text-gray-600">{household.instructions}</p>}
                    {household.instructions_video_url && (
                      <video src={household.instructions_video_url} controls className="w-full max-w-sm rounded-lg" style={{ maxHeight: '200px' }}>
                        {t('common.videoNotSupported')}
                      </video>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic mt-1">{t('admin.householdManagement.noInstructions')}</p>
                )}
              </div>
            </div>

            {/* Kashrut */}
            <div data-testid={`household-kashrut-section-${householdSelector}`}>
              <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.kashrut')}:</span>
              {household.kashrut_preferences && household.kashrut_preferences.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {household.kashrut_preferences.map(pref => (
                    <Badge key={pref} variant="secondary" className="text-xs">{getKashrutOptionName(pref)}</Badge>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-500 italic mt-1">{t('admin.householdManagement.noKashrut')}</p>}
            </div>

            {/* Vendors */}
            <div data-testid={`household-vendors-section-${householdSelector}`}>
              <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.vendor')}:</span>
              {household.viewable_vendors && household.viewable_vendors.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {household.viewable_vendors.map(v => (
                    <Badge key={v.vendor_id} variant="secondary" className="text-xs">
                      {isRTL ? (v.vendor_name_hebrew || v.vendor_name) : v.vendor_name}
                    </Badge>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-500 italic mt-1">{t('admin.householdManagement.noVendor')}</p>}
            </div>

            {/* Staff Orderable Stores */}
            <div data-testid={`household-staff-stores-section-${householdSelector}`}>
              <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.staffStores')}:</span>
              {household.staff_orderable_vendors && household.staff_orderable_vendors.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {household.staff_orderable_vendors.map(v => (
                    <Badge key={v.vendor_id} variant="outline" className="text-xs">
                      {isRTL ? (v.vendor_name_hebrew || v.vendor_name) : v.vendor_name}
                    </Badge>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-500 italic mt-1">{t('admin.householdManagement.noStaffStores')}</p>}
            </div>

            {/* Staff Members */}
            <div data-testid={`household-staff-section-${householdSelector}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.staffMembers').replace('{{count}}', staff.length)}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowStaffForm(showStaffForm === household.id ? null : household.id)}>
                  <Plus className="w-4 h-4 mr-1" />{t('admin.householdManagement.addStaff')}
                </Button>
              </div>

              {staff.length > 0 ? (
                <div className="space-y-2">
                  {staff.map(staffMember => (
                    <div key={staffMember.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 rounded border gap-3" data-testid={`household-staff-member-${householdSelector}-${staffMember.id}`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{getStaffUserName(staffMember.staff_user_id)}</span>
                          {staffMember.job_role && (
                            <Badge variant="secondary" className="text-xs">
                              {staffMember.job_role.charAt(0).toUpperCase() + staffMember.job_role.slice(1)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Combobox
                            value={staffMember.payment_type || 'hourly'}
                            onChange={value => handleUpdatePaymentType(staffMember.id, value)}
                            options={[
                              { value: 'hourly', label: 'Hourly' },
                              { value: 'daily', label: 'Daily' }
                            ]}
                            placeholder="Select"
                            className="w-24"
                          />
                          {(staffMember.payment_type || 'hourly') === 'hourly' ? (
                            <>
                              <span className="text-xs text-gray-500">₪/hr:</span>
                              <input type="number" min="0" step="0.5" defaultValue={staffMember.price_per_hour || 0}
                                onBlur={e => handleUpdateStaffPrice(staffMember.id, 'price_per_hour', e.target.value)}
                                className="w-20 border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-blue-400" placeholder="0" />
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-gray-500">₪/day:</span>
                              <input type="number" min="0" step="0.5" defaultValue={staffMember.price_per_day || 0}
                                onBlur={e => handleUpdateStaffPrice(staffMember.id, 'price_per_day', e.target.value)}
                                className="w-20 border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-blue-400" placeholder="0" />
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <div className="flex items-center space-x-2">
                          <Switch checked={staffMember.can_order} onCheckedChange={() => handleToggleOrderPermission(staffMember.id, staffMember.can_order)} />
                          <Label className="text-xs">{t('admin.householdManagement.canOrder')}</Label>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleSetLead(household.id, staffMember.id)} disabled={staffMember.is_lead} className="disabled:opacity-50 disabled:cursor-not-allowed">
                          <Star className="w-4 h-4 mr-2" />
                          {staffMember.is_lead ? t('admin.householdManagement.lead') : t('admin.householdManagement.setAsLead')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleOpenPayDialog(staffMember.staff_user_id)} className="text-green-600 border-green-300 hover:bg-green-50">
                          <DollarSign className="w-4 h-4 mr-1" />Pay
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveStaff(staffMember.id)} className="h-8 w-8 text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic p-2">{t('admin.householdManagement.noStaffAssigned')}</p>
              )}
            </div>

            {/* Add Staff Form */}
            {showStaffForm === household.id && (
              <div className="border-t pt-4 space-y-3" data-testid={`household-add-staff-form-${householdSelector}`}>
                <Label className="text-sm font-medium">{t('admin.householdManagement.addStaffMember')}</Label>
                <Combobox
                  value={newStaffData.staff_user_id}
                  onChange={value => setNewStaffData(prev => ({ ...prev, staff_user_id: value }))}
                  options={kcsUsers.map(user => {
                    const firstName = user.first_name || '';
                    const lastName = user.last_name || '';
                    const displayName = [firstName, lastName].filter(Boolean).join(' ') || user.full_name || 'Unknown';
                    return { value: user.id, label: `${displayName} (${user.email})` };
                  })}
                  placeholder={t('admin.householdManagement.selectKCSStaff')}
                />
                <Combobox
                  value={newStaffData.job_role}
                  onChange={value => setNewStaffData(prev => ({ ...prev, job_role: value }))}
                  options={jobRoles.map(role => ({ value: role, label: role.charAt(0).toUpperCase() + role.slice(1) }))}
                  placeholder={t('admin.householdManagement.selectJobRole')}
                />
                <div className="flex items-center gap-2">
                  <Combobox
                    value={newStaffData.payment_type}
                    onChange={value => setNewStaffData(prev => ({ ...prev, payment_type: value }))}
                    options={[
                      { value: 'hourly', label: 'Hourly' },
                      { value: 'daily', label: 'Daily' }
                    ]}
                    placeholder="Select payment type"
                    className="w-32"
                  />
                  {newStaffData.payment_type === 'hourly' ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">₪/hr:</span>
                      <input type="number" min="0" step="0.5" placeholder="0" value={newStaffData.price_per_hour}
                        onChange={e => setNewStaffData(prev => ({ ...prev, price_per_hour: e.target.value }))}
                        className="w-24 border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">₪/day:</span>
                      <input type="number" min="0" step="0.5" placeholder="0" value={newStaffData.price_per_day}
                        onChange={e => setNewStaffData(prev => ({ ...prev, price_per_day: e.target.value }))}
                        className="w-24 border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id={`can-order-${household.id}`} checked={newStaffData.can_order} onCheckedChange={checked => setNewStaffData(prev => ({ ...prev, can_order: checked }))} />
                  <Label htmlFor={`can-order-${household.id}`} className="text-sm font-normal">{t('admin.householdManagement.allowOrderPermission')}</Label>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAddStaff(household.id)}>{t('admin.householdManagement.addStaff')}</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowStaffForm(null)}>{t('admin.householdManagement.cancel')}</Button>
                </div>
              </div>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}