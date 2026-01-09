
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Store, Home, ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import { Order, Household, Vendor } from '@/entities/all';
import { useLanguage } from '../i18n/LanguageContext';
import { format } from 'date-fns';

export default function VendorHouseholdBilling() {
  const { t, language, isRTL } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    vendor: '',
    household: '',
    status: 'all',
    isPaid: 'all'
  });
  
  const [sortConfig, setSortConfig] = useState({ key: 'totalAmount', direction: 'desc' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [ordersData, householdsData, vendorsData] = await Promise.all([
        Order.filter({ status: { $in: ['delivery', 'delivered'] } }),
        Household.list(),
        Vendor.list()
      ]);
      setOrders(ordersData);
      setHouseholds(householdsData);
      setVendors(vendorsData);
    } catch (error) {
      console.error('Error loading billing data:', error);
      alert(t('common.loadError', 'Failed to load data'));
    } finally {
      setIsLoading(false);
    }
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) return t('common.unknown');
    return language === 'Hebrew' ? (vendor.name_hebrew || vendor.name) : vendor.name;
  };

  const getHouseholdDisplayName = (householdId) => {
    const household = households.find(h => h.id === householdId);
    if (!household) return t('common.unknown');
    const name = language === 'Hebrew' ? (household.name_hebrew || household.name) : household.name;
    return household.household_code ? `${name} (#${household.household_code})` : name;
  };

  const vendorHouseholdData = useMemo(() => {
    // Group orders by vendor-household pairs
    const grouped = {};
    
    orders.forEach(order => {
      const key = `${order.vendor_id}_${order.household_id}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          vendorId: order.vendor_id,
          householdId: order.household_id,
          vendorName: getVendorName(order.vendor_id),
          householdName: getHouseholdDisplayName(order.household_id),
          totalOrders: 0,
          paidOrders: 0,
          unpaidOrders: 0,
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0
        };
      }
      
      grouped[key].totalOrders++;
      grouped[key].totalAmount += order.total_amount || 0;
      
      if (order.is_paid) {
        grouped[key].paidOrders++;
        grouped[key].paidAmount += order.total_amount || 0;
      } else {
        grouped[key].unpaidOrders++;
        grouped[key].unpaidAmount += order.total_amount || 0;
      }
    });
    
    return Object.values(grouped);
  }, [orders, vendors, households, language]); // Added language to dependency array for dynamic name resolution

  const filteredData = useMemo(() => {
    let filtered = vendorHouseholdData;
    
    if (filters.vendor) {
      filtered = filtered.filter(item => 
        item.vendorName.toLowerCase().includes(filters.vendor.toLowerCase())
      );
    }
    
    if (filters.household) {
      filtered = filtered.filter(item => 
        item.householdName.toLowerCase().includes(filters.household.toLowerCase())
      );
    }
    
    if (filters.isPaid !== 'all') {
      const isPaidFilter = filters.isPaid === 'yes';
      filtered = filtered.filter(item => 
        isPaidFilter ? item.unpaidAmount === 0 : item.unpaidAmount > 0
      );
    }
    
    // Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }
    
    return filtered;
  }, [vendorHouseholdData, filters, sortConfig]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, item) => ({
      totalOrders: acc.totalOrders + item.totalOrders,
      totalAmount: acc.totalAmount + item.totalAmount,
      paidAmount: acc.paidAmount + item.paidAmount,
      unpaidAmount: acc.unpaidAmount + item.unpaidAmount
    }), { totalOrders: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0 });
  }, [filteredData]);

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      alert(t('common.listEmpty'));
      return;
    }
    
    // Get unique households and vendors from the current filtered data
    const uniqueHouseholds = [...new Set(filteredData.map(item => item.householdId))];
    const uniqueVendors = [...new Set(filteredData.map(item => item.vendorId))];
    
    // Create pivot structure: households as rows, vendors as columns
    const pivotData = {};
    
    filteredData.forEach(item => {
      if (!pivotData[item.householdId]) {
        pivotData[item.householdId] = {
          householdName: item.householdName,
          vendors: {}
        };
      }
      pivotData[item.householdId].vendors[item.vendorId] = {
        totalAmount: item.totalAmount,
        unpaidAmount: item.unpaidAmount
      };
    });
    
    // Build CSV headers: Household name + vendor names
    const vendorNames = uniqueVendors.map(vendorId => getVendorName(vendorId));
    const headers = [
      t('admin.billing.household', 'Household'),
      ...uniqueVendors.flatMap(vendorId => [
        `${getVendorName(vendorId)} - ${t('admin.billing.totalAmount', 'Total')}`,
        `${getVendorName(vendorId)} - ${t('admin.billing.unpaidAmount', 'Unpaid')}`
      ])
    ];
    
    // Build CSV rows
    const csvRows = uniqueHouseholds.map(householdId => {
      const householdData = pivotData[householdId];
      const row = [householdData.householdName];
      
      uniqueVendors.forEach(vendorId => {
        const vendorSpecificData = householdData.vendors[vendorId];
        row.push(vendorSpecificData ? vendorSpecificData.totalAmount.toFixed(2) : '0.00');
        row.push(vendorSpecificData ? vendorSpecificData.unpaidAmount.toFixed(2) : '0.00');
      });
      
      return row;
    });
    
    // Add totals row
    const totalsRow = [t('admin.billing.total', 'Total')];
    uniqueVendors.forEach(vendorId => {
      const vendorTotal = filteredData
        .filter(item => item.vendorId === vendorId)
        .reduce((sum, item) => sum + item.totalAmount, 0);
      totalsRow.push(vendorTotal.toFixed(2));
      
      const vendorUnpaid = filteredData
        .filter(item => item.vendorId === vendorId)
        .reduce((sum, item) => sum + item.unpaidAmount, 0);
      totalsRow.push(vendorUnpaid.toFixed(2));
    });
    
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(',')),
      totalsRow.map(cell => `"${cell}"`).join(',')
    ].join('\n');
    
    // Add UTF-8 BOM for proper Hebrew display in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vendor-household-billing-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const SortableHeader = ({ sortKey, children }) => {
    const isSorted = sortConfig.key === sortKey;
    return (
      <button 
        onClick={() => handleSort(sortKey)} 
        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
      >
        {children}
        {isSorted && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className={`flex flex-col sm:flex-row justify-between sm:items-center gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t('admin.billing.vendorHouseholdBilling', 'Vendor-Household Billing')}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
            {t('common.exportCSV', 'Export CSV')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-blue-50">
            <CardContent className="p-4">
              <div className="text-sm text-blue-600 font-medium">{t('admin.billing.totalPairs', 'Total Pairs')}</div>
              <div className="text-2xl font-bold text-blue-700">{filteredData.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardContent className="p-4">
              <div className="text-sm text-green-600 font-medium">{t('admin.billing.totalOrders', 'Total Orders')}</div>
              <div className="text-2xl font-bold text-green-700">{totals.totalOrders}</div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50">
            <CardContent className="p-4">
              <div className="text-sm text-purple-600 font-medium">{t('admin.billing.totalRevenue', 'Total Revenue')}</div>
              <div className="text-2xl font-bold text-purple-700">₪{totals.totalAmount.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50">
            <CardContent className="p-4">
              <div className="text-sm text-orange-600 font-medium">{t('admin.billing.outstandingAmount', 'Outstanding')}</div>
              <div className="text-2xl font-bold text-orange-700">₪{totals.unpaidAmount.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Input
              placeholder={t('admin.billing.filterByVendor', 'Filter by vendor...')}
              value={filters.vendor}
              onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}
            />
          </div>
          <div>
            <Input
              placeholder={t('admin.billing.filterByHousehold', 'Filter by household...')}
              value={filters.household}
              onChange={(e) => setFilters({ ...filters, household: e.target.value })}
            />
          </div>
          <div>
            <Select value={filters.isPaid} onValueChange={(value) => setFilters({ ...filters, isPaid: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t('admin.billing.paymentStatus', 'Payment Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all', 'All')}</SelectItem>
                <SelectItem value="yes">{t('admin.billing.fullyPaid', 'Fully Paid')}</SelectItem>
                <SelectItem value="no">{t('admin.billing.hasOutstanding', 'Has Outstanding')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                  <SortableHeader sortKey="vendorName">{t('admin.billing.vendor', 'Vendor')}</SortableHeader>
                </TableHead>
                <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                  <SortableHeader sortKey="householdName">{t('admin.billing.household', 'Household')}</SortableHeader>
                </TableHead>
                <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                  <SortableHeader sortKey="totalOrders">{t('admin.billing.totalOrders', 'Orders')}</SortableHeader>
                </TableHead>
                <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                  <SortableHeader sortKey="totalAmount">{t('admin.billing.totalAmount', 'Total')}</SortableHeader>
                </TableHead>
                <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                  <SortableHeader sortKey="paidAmount">{t('admin.billing.paidAmount', 'Paid')}</SortableHeader>
                </TableHead>
                <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                  <SortableHeader sortKey="unpaidAmount">{t('admin.billing.unpaidAmount', 'Unpaid')}</SortableHeader>
                </TableHead>
                <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                  {t('admin.billing.paymentRate', 'Payment Rate')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? filteredData.map((item, index) => {
                const paymentRate = item.totalAmount > 0 ? (item.paidAmount / item.totalAmount) * 100 : 0;
                return (
                  <TableRow key={`${item.vendorId}_${item.householdId}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <TableCell className={`${isRTL ? 'text-right' : 'text-left'} font-medium`}>
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-green-600" />
                        {item.vendorName}
                      </div>
                    </TableCell>
                    <TableCell className={isRTL ? 'text-right' : 'text-left'}>
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-blue-600" />
                        {item.householdName}
                      </div>
                    </TableCell>
                    <TableCell className={isRTL ? 'text-right' : 'text-left'}>
                      {item.totalOrders}
                      <span className="text-xs text-gray-500 ltr:ml-1 rtl:mr-1">
                        ({item.paidOrders}/{item.unpaidOrders})
                      </span>
                    </TableCell>
                    <TableCell className={`${isRTL ? 'text-right' : 'text-left'} font-semibold text-blue-600`}>
                      ₪{item.totalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className={`${isRTL ? 'text-right' : 'text-left'} font-semibold text-green-600`}>
                      ₪{item.paidAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className={`${isRTL ? 'text-right' : 'text-left'} font-semibold ${item.unpaidAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₪{item.unpaidAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className={isRTL ? 'text-right' : 'text-left'}>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${paymentRate}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">
                          {paymentRate.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan="7" className="text-center py-8 text-gray-500">
                    {t('admin.billing.noData', 'No billing data found')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
