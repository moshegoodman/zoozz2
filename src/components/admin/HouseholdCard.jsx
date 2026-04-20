import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Home, Edit, MapPin, FileVideo, Settings, ShoppingCart, Calendar,
  Store, Copy, Briefcase, Plus, Star, DollarSign, Trash2, User as UserIcon,
  ChevronDown, ChevronUp
} from "lucide-react";

const jobRoles = ["chef", "sous chef", "cook", "householdManager", "waiter", "housekeeping", "other"];

export default function HouseholdCard({
  household, staff, ownerNames, kcsUsers, showStaffForm, setShowStaffForm,
  newStaffData, setNewStaffData,
  handleEditDetails, handleStartShopping, handleViewMealCalendar,
  handleEditAddress, handleEditInstructions, handleEditKashrutPreferences,
  handleEditVendorPreferences, handleEditStaffOrderableVendors,
  setCopyingHousehold, setCopyTargetSeason,
  handleAddStaff, handleToggleOrderPermission, handleUpdateStaffPrice,
  handleUpdatePaymentType, handleRemoveStaff, handleSetLead, handleOpenPayDialog,
  getStaffUserName, getKashrutOptionName,
  isRTL, t
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border">
      {/* Clickable header to expand/collapse */}
      <CardHeader
        className="pb-3 cursor-pointer select-none hover:bg-gray-50 transition-colors rounded-t-xl"
        onClick={() => setIsExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <CardTitle className="text-lg truncate">{household.name}</CardTitle>
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
              {household.household_code && (
                <Badge variant="secondary" className="text-sm">
                  #{(household.household_code || '').slice(0, 4)}
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
          <div className="px-6 pb-3 flex flex-wrap gap-2 border-b" onClick={e => e.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={() => handleViewMealCalendar(household)} className="text-purple-600 border-purple-300 hover:bg-purple-50">
              <Calendar className="w-4 h-4 mr-1" />{t('admin.householdManagement.viewMealCalendar')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStartShopping(household)} className="bg-purple-50 text-purple-700 hover:bg-purple-100">
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
            <Button variant="outline" size="sm" onClick={() => { setCopyingHousehold(household); setCopyTargetSeason(""); }} className="text-green-600 border-green-300 hover:bg-green-50">
              <Copy className="w-4 h-4 mr-1" />Copy to Season
            </Button>
          </div>

          <CardContent className="space-y-4 pt-4">
            {/* Owner Info */}
            <div className="flex items-center justify-between">
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
            <div className="flex items-start gap-2">
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
            <div className="flex items-start gap-2">
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
            <div>
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
            <div>
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
            <div>
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
            <div>
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
                    <div key={staffMember.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 rounded border gap-3">
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
                          <select
                            value={staffMember.payment_type || 'hourly'}
                            onChange={e => handleUpdatePaymentType(staffMember.id, e.target.value)}
                            className="border rounded px-1 py-0.5 text-xs focus:outline-none focus:border-blue-400"
                          >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                          </select>
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
              <div className="border-t pt-4 space-y-3">
                <Label className="text-sm font-medium">{t('admin.householdManagement.addStaffMember')}</Label>
                <Select value={newStaffData.staff_user_id} onValueChange={value => setNewStaffData(prev => ({ ...prev, staff_user_id: value }))}>
                  <SelectTrigger><SelectValue placeholder={t('admin.householdManagement.selectKCSStaff')} /></SelectTrigger>
                  <SelectContent>
                    {kcsUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>{user.full_name} ({user.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newStaffData.job_role} onValueChange={value => setNewStaffData(prev => ({ ...prev, job_role: value }))}>
                  <SelectTrigger><SelectValue placeholder={t('admin.householdManagement.selectJobRole')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>{t('admin.householdManagement.selectJobRole')}</SelectItem>
                    {jobRoles.map(role => (
                      <SelectItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <select value={newStaffData.payment_type} onChange={e => setNewStaffData(prev => ({ ...prev, payment_type: e.target.value }))} className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                  </select>
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