
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { toIsraeliTime, isSameDayInIsrael } from '../i18n/dateUtils';

export default function CustomerDayCalendar({ orders, onOrderClick }) {
    const { t, language, isRTL } = useLanguage();
    const [weekStart, setWeekStart] = useState(() => startOfWeek(toIsraeliTime(new Date()), { weekStartsOn: 0 }));

    // Generate array of 7 days starting from weekStart
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }, [weekStart]);

    // Helper to parse delivery date from order
    const getOrderDeliveryDate = (order) => {
        if (!order.delivery_time) return null;
        
        // Try to extract YYYY-MM-DD from delivery_time
        const yyyyMmDdRegex = /^(\d{4}-\d{2}-\d{2})/;
        const match = order.delivery_time.match(yyyyMmDdRegex);
        
        if (match && match[1]) {
            try {
                return parseISO(match[1]);
            } catch (e) {
                return null;
            }
        }
        
        // Try parsing the whole string
        try {
            const date = new Date(order.delivery_time);
            if (!isNaN(date.getTime())) {
                return date;
            }
        } catch (e) {
            // ignore
        }
        
        return null;
    };

    // Group orders by household and day
    const ordersGrid = useMemo(() => {
        // First, get unique households
        const householdMap = new Map();
        
        orders.forEach(order => {
            const householdKey = order.household_id || order.user_email;
            const householdName = order.household_name || order.display_name || order.user_email;
            
            if (!householdMap.has(householdKey)) {
                householdMap.set(householdKey, {
                    key: householdKey,
                    name: householdName,
                    nameHebrew: order.household_name_hebrew,
                    code: order.household_code,
                    orders: []
                });
            }
            
            householdMap.get(householdKey).orders.push(order);
        });

        // Convert to array and sort by name
        const households = Array.from(householdMap.values()).sort((a, b) => 
            a.name.localeCompare(b.name)
        );

        // Create grid: for each household, get orders for each day
        return households.map(household => {
            const dayOrders = weekDays.map(day => {
                return household.orders.filter(order => {
                    const orderDate = getOrderDeliveryDate(order);
                    return orderDate && isSameDayInIsrael(orderDate, day);
                });
            });

            return {
                ...household,
                dayOrders
            };
        });
    }, [orders, weekDays]);

    const getStatusColor = (status) => {
        switch (status) {
            case "pending": return "bg-blue-100 text-blue-800 border-blue-200";
            case "follow_up": return "bg-cyan-100 text-cyan-800 border-cyan-200";
            case "shopping": return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "ready_for_shipping": return "bg-purple-100 text-purple-800 border-purple-200";
            case "delivery": return "bg-orange-100 text-orange-800 border-orange-200";
            case "delivered": return "bg-green-100 text-green-800 border-green-200";
            case "cancelled": return "bg-red-100 text-red-800 border-red-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getStatusLabel = (status) => {
        return t(`vendor.orderManagement.statusLabels.${status}`, status);
    };

    const goToPreviousWeek = () => {
        setWeekStart(prev => addDays(prev, -7));
    };

    const goToNextWeek = () => {
        setWeekStart(prev => addDays(prev, 7));
    };

    const goToCurrentWeek = () => {
        setWeekStart(startOfWeek(toIsraeliTime(new Date()), { weekStartsOn: 0 }));
    };

    return (
        <Card>
            <CardHeader>
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5" />
                        {t('vendor.customerDayCalendar.title', 'Customer-Day Calendar')}
                    </CardTitle >
                    <div dir='ltr' className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                            {t('vendor.customerDayCalendar.today', 'Today')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToNextWeek}>
                            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className={`p-3 border font-semibold text-sm ${isRTL ? 'text-right' : 'text-left'} bg-gray-100 min-w-[150px]`}>
                                    {t('vendor.customerDayCalendar.customer', 'Customer')}
                                </th>
                                {weekDays.map((day, index) => (
                                    <th key={index} className="p-3 border text-center font-semibold text-sm bg-gray-100 min-w-[120px]">
                                        <div>{format(day, 'EEE')}</div>
                                        <div className="text-xs text-gray-600">{format(day, 'MMM d')}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ordersGrid.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-gray-500">
                                        {t('vendor.customerDayCalendar.noOrders', 'No orders found for this week')}
                                    </td>
                                </tr>
                            ) : (
                                ordersGrid.map((household) => (
                                    <tr key={household.key} className="hover:bg-gray-50">
                                        <td className={`p-3 border ${isRTL ? 'text-right' : 'text-left'} bg-gray-50`}>
                                            <div className="font-medium text-sm">
                                                {language === 'Hebrew' ? (household.nameHebrew || household.name) : household.name}
                                            </div>
                                            {household.code && (
                                                <div className="text-xs text-gray-500">#{household.code}</div>
                                            )}
                                        </td>
                                        {household.dayOrders.map((dayOrders, dayIndex) => (
                                            <td key={dayIndex} className="p-2 border align-top">
                                                <div className="space-y-1">
                                                    {dayOrders.map((order) => (
                                                        <button
                                                            key={order.id}
                                                            onClick={() => onOrderClick(order)}
                                                            className="w-full text-left p-2 rounded hover:bg-gray-100 transition-colors"
                                                        >
                                                            <Badge className={`${getStatusColor(order.status)} text-xs`}>
                                                                {getStatusLabel(order.status)}
                                                            </Badge>
                                                            <div className="text-xs text-gray-600 mt-1">
                                                                ₪{order.total_amount?.toFixed(2) || '0.00'}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {order.items?.length || 0} {t('vendor.customerDayCalendar.items', 'items')}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
