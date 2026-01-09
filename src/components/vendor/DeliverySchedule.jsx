
import React, { useState, useEffect } from 'react';
import { Vendor } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Plus, Trash2, Copy, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subMonths, addMonths, endOfWeek } from 'date-fns';
import { formatDate, getDayName, getCurrentIsraeliTime, toIsraeliTime, isSameDayInIsrael } from '../i18n/dateUtils';
import { useLanguage } from '../i18n/LanguageContext';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Time slot options (24-hour format for easier handling)
const timeOptions = [];
for (let hour = 0; hour < 24; hour++) {
  for (let minute = 0; minute < 60; minute += 30) {
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const displayTime = format(new Date(2000, 0, 1, hour, minute), 'h:mm a');
    timeOptions.push({ value: timeString, label: displayTime });
  }
}

export default function DeliverySchedule({
  vendor,
  onUpdate,
  isTemplateMode = false,
  onApplyTemplate,
  isSaving: isSavingProp = false
}) {
  const { t, isRTL, language } = useLanguage();
  const [schedule, setSchedule] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentDaySlots, setCurrentDaySlots] = useState([]);
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('17:00');
  const [internalIsLoading, setInternalIsLoading] = useState(false);
  const [applyToAllDays, setApplyToAllDays] = useState(false);
  const [applyToWeekly, setApplyToWeekly] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDates, setCalendarDates] = useState([]);

  const isLoading = isTemplateMode ? isSavingProp : internalIsLoading;

  useEffect(() => {
    const firstDayOfMonth = startOfMonth(currentMonth);
    const lastDayOfMonth = endOfMonth(currentMonth);
    const startDate = startOfWeek(firstDayOfMonth);
    const endDate = endOfWeek(lastDayOfMonth);
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    setCalendarDates(dates);
  }, [currentMonth]);

  useEffect(() => {
    console.log('DeliverySchedule useEffect triggered', { 
      isTemplateMode, 
      hasVendor: !!vendor, 
      hasDetailedSchedule: !!vendor?.detailed_schedule,
      detailedScheduleType: typeof vendor?.detailed_schedule
    });
    
    if (isTemplateMode) {
      setSchedule({});
    } else if (vendor?.detailed_schedule) {
      try {
        // Safely parse detailed_schedule whether it's a string or object
        let parsedSchedule;
        if (typeof vendor.detailed_schedule === 'string') {
          console.log('Parsing detailed_schedule from string');
          parsedSchedule = JSON.parse(vendor.detailed_schedule);
        } else if (typeof vendor.detailed_schedule === 'object' && vendor.detailed_schedule !== null) {
          console.log('Using detailed_schedule as object');
          parsedSchedule = vendor.detailed_schedule;
        } else {
          console.warn('detailed_schedule is neither string nor object');
          parsedSchedule = {};
        }
        
        // Validate it's an object before using
        if (parsedSchedule && typeof parsedSchedule === 'object' && !Array.isArray(parsedSchedule)) {
          console.log('Setting schedule with', Object.keys(parsedSchedule).length, 'dates');
          setSchedule(parsedSchedule);
        } else {
          console.warn('Invalid detailed_schedule format, using empty schedule');
          setSchedule({});
        }
      } catch (error) {
        console.error('Error parsing detailed_schedule:', error);
        setSchedule({});
      }
    } else {
      console.log('No detailed_schedule found, setting empty schedule');
      setSchedule({});
    }
  }, [vendor, isTemplateMode]);

  const openEditDialog = (date) => {
    setSelectedDate(date);
    // Convert to Israeli time before creating the key
    const israeliDate = toIsraeliTime(date);
    const dateKey = format(israeliDate, 'yyyy-MM-dd');
    console.log('Opening edit dialog for', dateKey, 'slots:', schedule[dateKey]);
    setCurrentDaySlots(schedule[dateKey] || []);
    setIsEditDialogOpen(true);
    setApplyToAllDays(false);
    setApplyToWeekly(false);
  };

  const addTimeSlot = () => {
    if (newSlotStart >= newSlotEnd) {
      alert(t('vendor.deliverySchedule.endTimeAfterStart'));
      return;
    }
    const newSlot = { start: newSlotStart, end: newSlotEnd };
    setCurrentDaySlots(prev => [...prev, newSlot]);
  };

  const removeTimeSlot = (index) => {
    setCurrentDaySlots(prev => prev.filter((_, i) => i !== index));
  };

  const saveDay = async () => {
    // Convert to Israeli time before creating the key
    const israeliSelectedDate = toIsraeliTime(selectedDate);
    const dateKey = format(israeliSelectedDate, 'yyyy-MM-dd');
    let newSchedule = { ...schedule };
    
    const processSlots = (slots, key) => {
        if (slots.length === 0) {
          delete newSchedule[key];
        } else {
          newSchedule[key] = [...slots];
        }
    };

    processSlots(currentDaySlots, dateKey);

    if (applyToAllDays) {
      calendarDates.forEach(date => {
        if (isSameMonth(date, currentMonth)) {
            const israeliCalDate = toIsraeliTime(date);
            processSlots(currentDaySlots, format(israeliCalDate, 'yyyy-MM-dd'));
        }
      });
    }
    
    if (applyToWeekly) {
      const dayOfWeek = selectedDate.getDay();
      calendarDates.forEach(date => {
        if (date.getDay() === dayOfWeek) {
          const israeliCalDate = toIsraeliTime(date);
          processSlots(currentDaySlots, format(israeliCalDate, 'yyyy-MM-dd'));
        }
      });
    }

    console.log('Saving schedule with', Object.keys(newSchedule).length, 'dates');
    setSchedule(newSchedule);
    
    try {
      const success = await handleSave(newSchedule);
      if (success) {
        setIsEditDialogOpen(false);
        if(!isTemplateMode) alert(t('vendor.deliverySchedule.scheduleUpdated'));
      } else {
        if(!isTemplateMode) alert(t('vendor.deliverySchedule.scheduleUpdateFailed'));
      }
    } catch (error) {
      console.error("Error saving schedule:", error);
      if(!isTemplateMode) alert(t('vendor.deliverySchedule.scheduleUpdateFailed'));
    }
  };

  const handleSave = async (scheduleToSave) => {
    if (isTemplateMode) {
      if (onApplyTemplate) onApplyTemplate(scheduleToSave);
      return true;
    }

    if (!vendor?.id) return false;
    
    setInternalIsLoading(true);
    try {
      await Vendor.update(vendor.id, { detailed_schedule: scheduleToSave });
      if (onUpdate) onUpdate({ detailed_schedule: scheduleToSave });
      return true;
    } catch (error) {
      console.error("Error saving delivery schedule:", error);
      return false;
    } finally {
      setInternalIsLoading(false);
    }
  };

  const copyFromPreviousDay = () => {
    const previousDate = addDays(selectedDate, -1);
    const israeliPrevDate = toIsraeliTime(previousDate);
    const previousDateKey = format(israeliPrevDate, 'yyyy-MM-dd');
    const previousSlots = schedule[previousDateKey] || [];
    setCurrentDaySlots([...previousSlots]);
  };

  if (!vendor && !isTemplateMode) return null;

  return (
    <Card className={isTemplateMode ? 'border-blue-300' : ''}>
      <CardHeader className={isTemplateMode ? 'hidden' : ''}>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          {t('vendor.deliverySchedule.title')}
        </CardTitle>
        <CardDescription>
          {t('vendor.deliverySchedule.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold">{formatDate(currentMonth, 'MMMM yyyy', language)}</h3>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {daysOfWeek.map((day, index) => (
            <div key={day} className="text-center font-semibold text-xs p-2 bg-gray-100 rounded">
              {getDayName(new Date(2024, 0, index), language, true)}
            </div>
          ))}
          
          {calendarDates.map(date => {
            const israeliDate = toIsraeliTime(date);
            const dateKey = format(israeliDate, 'yyyy-MM-dd');
            const hasSlots = schedule[dateKey] && schedule[dateKey].length > 0;
            const isToday = isSameDayInIsrael(date, getCurrentIsraeliTime());
            const isCurrentMonth = isSameMonth(date, currentMonth);
            
            console.log('Rendering calendar cell', { dateKey, hasSlots, slotsCount: schedule[dateKey]?.length });
            
            return (
              <div
                key={dateKey}
                onClick={() => openEditDialog(date)}
                className={`
                  p-3 rounded border cursor-pointer transition-all hover:shadow-md h-24 flex flex-col justify-between
                  ${hasSlots ? 'bg-green-100 border-green-300 hover:bg-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'}
                  ${isToday ? 'ring-2 ring-blue-400' : ''}
                  ${!isCurrentMonth ? 'text-gray-400 bg-gray-50' : ''}
                `}
              >
                <div className={isRTL ? "text-left" : "text-right"}>
                  <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : ''}`}>
                    {format(date, 'd')}
                  </div>
                 </div>
                <div>
                  {hasSlots && (
                    <div className="text-xs text-green-700 font-medium">
                      {schedule[dateKey].length} {schedule[dateKey].length === 1 ? t('vendor.deliverySchedule.slotSingular') : t('vendor.deliverySchedule.slotPlural')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {t('vendor.deliverySchedule.editDeliveryHours')} - {selectedDate && formatDate(selectedDate, 'EEEE, MMMM d, yyyy', language)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold">{t('vendor.deliverySchedule.currentTimeSlots')}</Label>
                {currentDaySlots.length === 0 ? (
                  <p className="text-gray-500 text-sm mt-2">{t('vendor.deliverySchedule.noDeliveryHours')}</p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {currentDaySlots.map((slot, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                        <span className="font-medium">
                          {format(new Date(2000, 0, 1, ...slot.start.split(':').map(Number)), 'h:mm a')} - {' '}
                          {format(new Date(2000, 0, 1, ...slot.end.split(':').map(Number)), 'h:mm a')}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => removeTimeSlot(index)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold">{t('vendor.deliverySchedule.addNewTimeSlot')}</Label>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <Label htmlFor="start-time">{t('vendor.deliverySchedule.startTime')}</Label>
                    <Select value={newSlotStart} onValueChange={setNewSlotStart}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {timeOptions.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="end-time">{t('vendor.deliverySchedule.endTime')}</Label>
                    <Select value={newSlotEnd} onValueChange={setNewSlotEnd}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {timeOptions.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addTimeSlot} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      {t('vendor.deliverySchedule.addSlot')}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Button variant="outline" onClick={copyFromPreviousDay} className="w-full">
                  <Copy className="w-4 h-4 mr-2" />
                  {t('vendor.deliverySchedule.copyFromPrevious')}
                </Button>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Label className="text-base font-semibold">{t('vendor.deliverySchedule.applyTheseHours')}</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="apply-weekly" checked={applyToWeekly} onCheckedChange={setApplyToWeekly}/>
                    <Label htmlFor="apply-weekly" className="font-normal">{t('vendor.deliverySchedule.applyToWeekly')} ({selectedDate && getDayName(selectedDate, language)})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="apply-all" checked={applyToAllDays} onCheckedChange={setApplyToAllDays}/>
                    <Label htmlFor="apply-all" className="font-normal">{t('vendor.deliverySchedule.applyToAllDays')}</Label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>{t('vendor.deliverySchedule.cancel')}</Button>
              <Button onClick={saveDay} className="bg-green-600 hover:bg-green-700" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isTemplateMode ? t('common.apply') : t('vendor.deliverySchedule.saveHours')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isTemplateMode && (
          <div className="mt-6 text-right">
              <Button onClick={() => handleSave(schedule)} className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                 {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                 {t('admin.deliverySchedule.applySchedule')}
              </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
