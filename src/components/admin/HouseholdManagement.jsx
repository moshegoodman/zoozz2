import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Household, HouseholdStaff, User, KashrutOption, Vendor } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Home, Plus, User as UserIcon, Briefcase, ShoppingCart, Edit, Trash2, Settings, MapPin, FileVideo, Upload, Star, Calendar, Search, Download, Loader2, Store } from "lucide-react";
import { UploadFile, SendEmail } from "@/integrations/Core"; // Added SendEmail
import { createPageUrl } from "@/utils";
import { useLanguage } from "../i18n/LanguageContext";
import AddressEditModal from './AddressEditModal'; // Added import for AddressEditModal
import { exportHouseholds } from "@/functions/exportHouseholds";

const jobRoles = ["chef", "cook", "householdManager", "waiter", "housekeeping", "other"];

export default function HouseholdManagement({ households, householdStaff, users, onDataUpdate, onStaffUpdate }) {
    const { t, language } = useLanguage();
    const [newHouseholdName, setNewHouseholdName] = useState("");
    const [newHouseholdNameHebrew, setNewHouseholdNameHebrew] = useState("");
    const [newHouseholdCode, setNewHouseholdCode] = useState("");
    const [newHouseholdSeason, setNewHouseholdSeason] = useState("");
    const [newHouseholdCountry, setNewHouseholdCountry] = useState("");
    const isRTL = language === 'Hebrew';
    const [selectedOwnerId, setSelectedOwnerId] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [showStaffForm, setShowStaffForm] = useState(null);
    const [searchTerm, setSearchTerm] = useState(""); // Add search state
    const [newStaffData, setNewStaffData] = useState({
        staff_user_id: "",
        job_role: "",
        can_order: false
    });
    const [kashrutOptions, setKashrutOptions] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [editingHousehold, setEditingHousehold] = useState(null);
    const [selectedKashrutPreferences, setSelectedKashrutPreferences] = useState([]);
    const [selectedVendorPreferences, setSelectedVendorPreferences] = useState([]);
    const [selectedStaffOrderableVendors, setSelectedStaffOrderableVendors] = useState([]);
    const [isKashrutDialogOpen, setIsKashrutDialogOpen] = useState(false);
    const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
    const [isStaffVendorDialogOpen, setIsStaffVendorDialogOpen] = useState(false);

    // Address editing state - only the household object is needed here, the modal handles its own internal address state
    const [editingHouseholdAddress, setEditingHouseholdAddress] = useState(null);

    // New state for editing household details (name, etc.)
    const [editingHouseholdDetails, setEditingHouseholdDetails] = useState(null);
    const [householdName, setHouseholdName] = useState("");
    const [householdNameHebrew, setHouseholdNameHebrew] = useState("");
    const [householdOwnerId, setHouseholdOwnerId] = useState("");
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

    // New state variables for instructions
    const [editingHouseholdInstructions, setEditingHouseholdInstructions] = useState(null);
    const [householdInstructions, setHouseholdInstructions] = useState("");
    const [householdInstructionsVideo, setHouseholdInstructionsVideo] = useState("");
    const [isInstructionsDialogOpen, setIsInstructionsDialogOpen] = useState(false);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [isExporting, setIsExporting] = useState(false);


    // Load kashrut options on component mount
    useEffect(() => {
        loadKashrutOptions();
    }, []);
    useEffect(() => {
        loadVendors();
    }, []);

    const loadKashrutOptions = async () => {
        try {
            const options = await KashrutOption.filter({ is_active: true }, 'display_order');
            setKashrutOptions(options);
        } catch (error) {
            console.error("Error loading kashrut options:", error);
        }
    };
    const loadVendors = async () => {
        try {
            const vendorList = await Vendor.list();
            setVendors(vendorList);
        } catch (error) {
            console.error("Error loading vendor options:", error);
        }
    };

    const handleExportHouseholds = async () => {
        setIsExporting(true);
        try {
            const response = await exportHouseholds();
            // Handle the CSV data similar to how OrderManagement does it
            if (response.data) {
                // Prepend BOM (Byte Order Mark) for better compatibility with Excel, especially for Hebrew characters
                const blob = new Blob(['\ufeff', response.data], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `households_export_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } else {
                throw new Error("No data received from export function");
            }
        } catch (error) {
            console.error("Failed to export households:", error);
            alert(t("admin.householdManagement.exportFailed"));
        } finally {
            setIsExporting(false);
        }
    };

    // Filter users by type
    const kcsUsers = useMemo(() => users.filter(user => user.user_type === 'kcs staff'), [users]);
    const householdOwners = useMemo(() => users.filter(user => user.user_type === 'household owner'), [users]);

    // Helper functions
    // Memoize getOwnerName to make it a stable dependency for useMemo
    const getOwnerName = useCallback((ownerId) => {
        const owner = users.find(u => u.id === ownerId);
        return owner ? owner.full_name : null;
    }, [users]); // Depends on 'users' prop

    // Memoize getStaffUserName as well for consistency
    const getStaffUserName = useCallback((staffUserId) => {
        const staffUser = users.find(u => u.id === staffUserId);
        return staffUser ? staffUser.full_name : 'Unknown User';
    }, [users]); // Depends on 'users' prop

    const getHouseholdStaff = (householdId) => {
        return householdStaff.filter(staff => staff.household_id === householdId);
    };

    // Filter households based on search term
    const filteredHouseholds = useMemo(() => {
        if (!searchTerm.trim()) return households;

        const searchLower = searchTerm.toLowerCase();
        return households.filter(household => {
            const ownerName = household.owner_user_id ? getOwnerName(household.owner_user_id) : '';
            const searchFields = [
                household.name,
                household.name_hebrew,
                household.household_code,
                household.street,
                household.building_number,
                household.household_number,
                household.entrance_code, // Added for comprehensive search
                household.neighborhood,
                household.instructions,
                ownerName
            ];

            return searchFields.some(field =>
                field && field.toString().toLowerCase().includes(searchLower)
            );
        });
    }, [households, searchTerm, getOwnerName]); // Now getOwnerName is a stable dependency thanks to useCallback

    const handleCreateHousehold = async () => {
        if (!newHouseholdName.trim()) {
            alert(t("admin.householdManagement.enterHouseholdName"));
            return;
        }

        if (!/^[0-9]{4}$/.test(newHouseholdCode)) {
            alert(t('admin.householdManagement.codeDigitsError'));
            return;
        }

        if (!newHouseholdSeason.trim()) {
            alert("Please enter a season (e.g. 26P)");
            return;
        }

        const fullCode = `${newHouseholdCode}-${newHouseholdSeason.trim()}`;

        const codeExists = households.some(h => h.household_code === fullCode);
        if (codeExists) {
            alert(t('admin.householdManagement.codeExistsError'));
            return;
        }

        setIsCreating(true);
        try {
            const householdData = {
                name: newHouseholdName,
                name_hebrew: newHouseholdNameHebrew,
                household_code: fullCode,
                season: newHouseholdSeason.trim(),
                country: newHouseholdCountry.trim() || undefined,
                kashrut_preferences: [],
                ...(selectedOwnerId && { owner_user_id: selectedOwnerId })
            };

            const createdHousehold = await Household.create(householdData);

            if (selectedOwnerId) {
                await User.update(selectedOwnerId, { household_id: createdHousehold.id });
            }

            setNewHouseholdName("");
            setNewHouseholdNameHebrew("");
            setNewHouseholdCode("");
            setNewHouseholdSeason("");
            setNewHouseholdCountry("");
            setSelectedOwnerId("");
            await onDataUpdate();
        } catch (error) {
            console.error("Error creating household:", error);
            alert(t("admin.householdManagement.failedToCreateHousehold"));
        } finally {
            setIsCreating(false);
        }
    };

    // New functions for editing household details
    const handleEditDetails = (household) => {
        setEditingHouseholdDetails(household);
        setHouseholdName(household.name || "");
        setHouseholdNameHebrew(household.name_hebrew || "");
        setHouseholdOwnerId(household.owner_user_id || "");
        setIsDetailsDialogOpen(true);
    };

    const handleSaveDetails = async () => {
        if (!editingHouseholdDetails) return;

        try {
            const oldOwnerId = editingHouseholdDetails.owner_user_id;
            const newOwnerId = householdOwnerId || null;

            // Update the household
            await Household.update(editingHouseholdDetails.id, {
                name: householdName,
                name_hebrew: householdNameHebrew,
                owner_user_id: newOwnerId,
            });

            // Handle user household_id updates
            if (oldOwnerId && oldOwnerId !== newOwnerId) {
                // Remove household_id from previous owner
                await User.update(oldOwnerId, { household_id: null });
            }

            if (newOwnerId && newOwnerId !== oldOwnerId) {
                // Set household_id for new owner
                await User.update(newOwnerId, { household_id: editingHouseholdDetails.id });
            }

            setIsDetailsDialogOpen(false);
            setEditingHouseholdDetails(null);
            await onDataUpdate();
        } catch (error) {
            console.error("Error updating household details:", error);
            alert(t('admin.householdManagement.failedToUpdateDetails'));
        }
    };

    const handleEditKashrutPreferences = (household) => {
        setEditingHousehold(household);
        setSelectedKashrutPreferences(household.kashrut_preferences || []);
        setIsKashrutDialogOpen(true);
    };
    const handleEditVendorPreferences = (household) => {
        setEditingHousehold(household);
        const currentVendorIds = household.viewable_vendors?.map(v => v.vendor_id) || [];
        setSelectedVendorPreferences(currentVendorIds);
        setIsVendorDialogOpen(true);
    };

    const handleEditStaffOrderableVendors = (household) => {
        setEditingHousehold(household);
        const currentStaffVendorIds = household.staff_orderable_vendors?.map(v => v.vendor_id) || [];
        setSelectedStaffOrderableVendors(currentStaffVendorIds);
        setIsStaffVendorDialogOpen(true);
    };

    const handleSaveKashrutPreferences = async () => {
        if (!editingHousehold) return;

        try {
            await Household.update(editingHousehold.id, {
                kashrut_preferences: selectedKashrutPreferences
            });
            setIsKashrutDialogOpen(false);
            setEditingHousehold(null);
            setSelectedKashrutPreferences([]);
            await onDataUpdate();
        } catch (error) {
            console.error("Error updating kashrut preferences:", error);
            alert(t("admin.householdManagement.failedToUpdateKashrut"));
        }
    };

    const handleKashrutPreferenceChange = (optionValue, checked) => {
        if (checked) {
            setSelectedKashrutPreferences(prev => [...prev, optionValue]);
        } else {
            setSelectedKashrutPreferences(prev => prev.filter(val => val !== optionValue));
        }
    };

    const getKashrutOptionName = (value) => {
        const option = kashrutOptions.find(opt => opt.value === value);
        return option ? option.name : value;
    };



    const handleSaveVendorPreferences = async () => {
        if (!editingHousehold) return;

        try {
            const newViewableVendors = selectedVendorPreferences.map(vendorId => {
                const vendor = vendors.find(v => v.id === vendorId);
                if (!vendor) return null;
                return {
                    vendor_id: vendor.id,
                    vendor_name: vendor.name,
                    vendor_name_hebrew: vendor.name_hebrew || null
                };
            }).filter(Boolean);

            await Household.update(editingHousehold.id, {
                viewable_vendors: newViewableVendors
            });

            setIsVendorDialogOpen(false);
            setEditingHousehold(null);
            setSelectedVendorPreferences([]);
            await onDataUpdate();
        } catch (error) {
            console.error("Error updating vendor preferences:", error);
            alert(t("admin.householdManagement.failedToUpdateVendor"));
        }
    };

    const handleVendorPreferenceChange = (optionValue, checked) => {
        if (checked) {
            setSelectedVendorPreferences(prev => [...prev, optionValue]);
        } else {
            setSelectedVendorPreferences(prev => prev.filter(val => val !== optionValue));
        }
    };

    const handleStaffOrderableVendorChange = (vendorId, checked) => {
        if (checked) {
            setSelectedStaffOrderableVendors(prev => [...prev, vendorId]);
        } else {
            setSelectedStaffOrderableVendors(prev => prev.filter(id => id !== vendorId));
        }
    };

    const handleSaveStaffOrderableVendors = async () => {
        if (!editingHousehold) return;

        try {
            const staffOrderableVendors = selectedStaffOrderableVendors.map(vendorId => {
                const vendor = vendors.find(v => v.id === vendorId);
                if (!vendor) return null;
                return {
                    vendor_id: vendor.id,
                    vendor_name: vendor.name,
                    vendor_name_hebrew: vendor.name_hebrew || null
                };
            }).filter(Boolean);

            await Household.update(editingHousehold.id, {
                staff_orderable_vendors: staffOrderableVendors
            });

            setIsStaffVendorDialogOpen(false);
            setEditingHousehold(null);
            setSelectedStaffOrderableVendors([]);
            await onDataUpdate();
        } catch (error) {
            console.error("Error updating staff orderable vendors:", error);
            alert(t("admin.householdManagement.failedToUpdateStaffVendors"));
        }
    };

    // New functions for address editing - now just sets the household for the modal
    const handleEditAddress = (household) => {
        setEditingHouseholdAddress(household);
    };

    // Callback when AddressEditModal saves successfully
    const handleSaveAddress = async () => {
        await onDataUpdate(); // Refresh data after address is saved by the modal
        setEditingHouseholdAddress(null); // Close the modal
    };

    // New functions for instructions editing
    const handleEditInstructions = (household) => {
        setEditingHouseholdInstructions(household);
        setHouseholdInstructions(household.instructions || "");
        setHouseholdInstructionsVideo(household.instructions_video_url || "");
        setIsInstructionsDialogOpen(true);
    };

    const handleVideoUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsUploadingVideo(true);
        try {
            // Add retry logic for video uploads
            let retries = 3;
            let lastError;

            while (retries > 0) {
                try {
                    const { file_url } = await UploadFile({ file });
                    setHouseholdInstructionsVideo(file_url);
                    return; // Success - exit the function
                } catch (error) {
                    lastError = error;
                    retries--;

                    // If it's a timeout error, wait before retrying
                    if (error.response?.status === 500 || error.response?.status === 544) {
                        if (retries > 0) {
                            console.log(`Video upload failed, retrying... (${retries} attempts left)`);
                            // Wait 3 seconds before retry (videos are larger)
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            continue; // Continue to the next retry attempt
                        }
                    } else {
                        // For non-timeout errors, don't retry, just re-throw
                        throw error;
                    }
                }
            }

            // If we get here, all retries failed, throw the last error
            throw lastError;

        } catch (error) {
            console.error("Error uploading video:", error);

            // Provide more specific error messages
            if (error.response?.status === 544) {
                alert(t("admin.householdManagement.databaseTimeoutVideo") || "Database timeout while uploading video - please try again in a moment");
            } else if (error.response?.status === 500) {
                alert(t("admin.householdManagement.serverErrorVideo") || "Server error while uploading video - please try again in a moment");
            } else {
                alert(t("admin.householdManagement.failedToUploadVideo") || "Failed to upload video - please try again");
            }
        } finally {
            setIsUploadingVideo(false);
            // Clear the file input value to allow re-uploading the same file if needed
            event.target.value = '';
        }
    };

    const handleSaveInstructions = async () => {
        if (!editingHouseholdInstructions) return;

        try {
            await Household.update(editingHouseholdInstructions.id, {
                instructions: householdInstructions.trim(),
                instructions_video_url: householdInstructionsVideo.trim()
            });
            setIsInstructionsDialogOpen(false);
            setEditingHouseholdInstructions(null);
            setHouseholdInstructions("");
            setHouseholdInstructionsVideo("");
            await onDataUpdate();
        } catch (error) {
            console.error("Error updating household instructions:", error);
            alert(t("admin.householdManagement.failedToUpdateInstructions"));
        }
    };

    const handleAddStaff = async (householdId) => {
        if (!newStaffData.staff_user_id) {
            alert(t("admin.householdManagement.selectStaffMember"));
            return;
        }
        if (!newStaffData.job_role) {
            alert(t("admin.householdManagement.selectJobRoleAlert"));
            return;
        }

        try {
            await HouseholdStaff.create({
                household_id: householdId,
                staff_user_id: newStaffData.staff_user_id,
                job_role: newStaffData.job_role,
                can_order: newStaffData.can_order
            });

            // Send email notification to the staff member
            try {
                const staffUser = users.find(u => u.id === newStaffData.staff_user_id);
                const household = households.find(h => h.id === householdId);
                const currentUser = await User.me();

                if (staffUser && household) {
                    const jobRoleDisplayName = newStaffData.job_role.charAt(0).toUpperCase() + newStaffData.job_role.slice(1);

                    const emailSubject = `Assignment to Household - ${household.name}`;

                    const emailBody = `
Dear ${staffUser.full_name || staffUser.email},

You have been assigned to work for a household in the Zoozz platform.

Assignment Details:
• Household: ${household.name} ${household.name_hebrew ? `(${household.name_hebrew})` : ''}
• Household Code: ${household.household_code || 'Not set'}
• Your Role: ${jobRoleDisplayName}
• Order Permission: ${newStaffData.can_order ? 'Yes - You can place orders for this household' : 'No - You cannot place orders for this household'}
• Assigned by: ${currentUser.full_name || currentUser.email}
• Assignment Date: ${new Date().toLocaleString('en-US', {
                        timeZone: 'Asia/Jerusalem',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })} (Israel Time)

${household.street ? `
Household Address:
${[household.street, household.building_number, household.household_number, household.neighborhood].filter(Boolean).join(', ')}
` : ''}

${household.instructions ? `
Special Instructions:
${household.instructions}
` : ''}

Please log in to the Zoozz platform to view your assignments and start working with this household.

${newStaffData.can_order ? 'Since you have order permissions, you can place orders on behalf of this household.' : 'If you need order permissions in the future, please contact your administrator.'}

Best regards,
Zoozz Management System
                    `.trim();

                    await SendEmail({
                        to: staffUser.email,
                        subject: emailSubject,
                        body: emailBody,
                        from_name: 'Zoozz System'
                    });
                }
            } catch (emailError) {
                console.error("Failed to send staff assignment notification:", emailError);
                // Don't block the staff addition if email fails
            }

            setNewStaffData({ staff_user_id: "", job_role: "", can_order: false });
            setShowStaffForm(null);
            if (onStaffUpdate) await onStaffUpdate(); else await onDataUpdate();
        } catch (error) {
            console.error("Error adding staff:", error);
            alert(t("admin.householdManagement.failedToAddStaff"));
        }
    };

    const handleToggleOrderPermission = async (staffId, currentPermission) => {
        try {
            await HouseholdStaff.update(staffId, { can_order: !currentPermission });
            if (onStaffUpdate) await onStaffUpdate(); else await onDataUpdate();
        } catch (error) {
            console.error("Error updating order permission:", error);
            alert(t("admin.householdManagement.failedToUpdatePermission"));
        }
    };

    const handleRemoveStaff = async (staffId) => {
        if (window.confirm(t('admin.householdManagement.removeStaffConfirm'))) {
            try {
                await HouseholdStaff.delete(staffId);
                if (onStaffUpdate) await onStaffUpdate(); else await onDataUpdate();
            } catch (error) {
                console.error("Error removing staff:", error);
                alert(t("admin.householdManagement.failedToRemoveStaff"));
            }
        }
    };

    const handleStartShopping = (household) => {
        sessionStorage.setItem('shoppingForHousehold', JSON.stringify(household));
        window.dispatchEvent(new Event('shoppingModeChanged'));
        // For admin/chief of staff, go to regular home page but in shopping mode
        window.location.href = createPageUrl("Home");
    };

    const handleViewMealCalendar = (household) => {
        sessionStorage.setItem('shoppingForHousehold', JSON.stringify(household));
        window.dispatchEvent(new Event('shoppingModeChanged'));
        // For admin/chief of staff, go to regular home page but in shopping mode
        window.location.href = createPageUrl("MealCalendar");
    };

    const handleSetLead = async (householdId, newLeadStaffLinkId) => {
        try {
            const allStaffLinks = await HouseholdStaff.filter({ household_id: householdId });
            const currentLeadLink = allStaffLinks.find(link => link.is_lead);
            const newLeadLink = allStaffLinks.find(link => link.id === newLeadStaffLinkId);

            // Get the user details for the new lead
            const newLeadUser = users.find(u => u.id === newLeadLink.staff_user_id);

            const updates = [];
            if (currentLeadLink && currentLeadLink.id !== newLeadStaffLinkId) {
                updates.push(HouseholdStaff.update(currentLeadLink.id, { is_lead: false }));
            }

            updates.push(HouseholdStaff.update(newLeadStaffLinkId, { is_lead: true }));

            // Update the household with the new lead information
            updates.push(Household.update(householdId, {
                lead_id: newLeadUser?.id || null,
                lead_name: newLeadUser?.full_name || null,
                lead_phone: newLeadUser?.phone || null
            }));

            await Promise.all(updates);
            if (onStaffUpdate) await onStaffUpdate(); else await onDataUpdate();
        } catch (error) {
            console.error("Failed to set new lead:", error);
            alert(t("admin.householdManagement.failedToSetLead"));
        }
    };

    return (
        <Card dir={isRTL ? 'rtl' : 'ltr'}>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2">
                        <Home className="w-5 h-5" />
                        {t('admin.householdManagement.title')}
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportHouseholds}
                        disabled={isExporting}
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        {isExporting ? t('common.exporting') : t('common.export')}
                    </Button>
                </div>

                {/* Search Bar */}
                <div className="relative mt-4">
                    <Search className={`absolute top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
                    <Input
                        placeholder={t('admin.householdManagement.searchHouseholds', 'Search households by name, code, address, owner...')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`${isRTL ? 'pr-10 text-right' : 'pl-10'} w-full`}
                        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                    />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Create Household Form */}
                <div className="border rounded-lg p-4 bg-gray-50">
                    <h3 className="text-lg font-semibold mb-4">{t('admin.householdManagement.createTitle')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="household-code">{t('admin.householdManagement.householdCode')}</Label>
                            <Input
                                id="household-code"
                                placeholder={t('admin.householdManagement.codePlaceholder')}
                                value={newHouseholdCode}
                                onChange={(e) => setNewHouseholdCode(e.target.value)}
                                disabled={isCreating}
                                maxLength={4}
                            />
                        </div>
                        <div>
                            <Label htmlFor="household-name">{t('admin.householdManagement.householdName')} (EN)</Label>
                            <Input
                                id="household-name"
                                placeholder={t('admin.householdManagement.namePlaceholder')}
                                value={newHouseholdName}
                                onChange={(e) => setNewHouseholdName(e.target.value)}
                                disabled={isCreating}
                            />
                        </div>
                        <div>
                            <Label htmlFor="household-name-hebrew">{t('admin.householdManagement.householdName')} (HE)</Label>
                            <Input
                                id="household-name-hebrew"
                                placeholder={t('admin.householdManagement.namePlaceholderHebrew')}
                                value={newHouseholdNameHebrew}
                                onChange={(e) => setNewHouseholdNameHebrew(e.target.value)}
                                disabled={isCreating}
                                style={{ direction: 'rtl' }}
                            />
                        </div>
                        <div className="lg:col-span-2">
                            <Label htmlFor="owner-select">{t('admin.householdManagement.owner')}</Label>
                            <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('admin.householdManagement.selectOwner')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null}>{t('admin.householdManagement.noOwner')}</SelectItem>
                                    {householdOwners.map(user => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.full_name} ({user.email})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button onClick={handleCreateHousehold} disabled={isCreating} className="w-full">
                                {isCreating ? t('admin.householdManagement.creating') : <><Plus className="w-4 h-4 mr-2" /> {t('admin.householdManagement.create')}</>}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Households List */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">{t('admin.householdManagement.existingHouseholds').replace('{{count}}', filteredHouseholds.length)}</h3>
                        {searchTerm && (
                            <div className="text-sm text-gray-600">
                                {t('admin.householdManagement.searchResults', {
                                    count: filteredHouseholds.length,
                                    total: households.length,
                                    defaultValue: `Showing ${filteredHouseholds.length} of ${households.length} households`
                                })}
                            </div>
                        )}
                    </div>

                    {filteredHouseholds.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Home className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            {searchTerm ? (
                                <div>
                                    <p>{t('admin.householdManagement.noSearchResults', 'No households found matching your search.')}</p>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setSearchTerm('')}
                                        className="mt-2"
                                    >
                                        {t('admin.householdManagement.clearSearch', 'Clear search')}
                                    </Button>
                                </div>
                            ) : (
                                <p>{t('admin.householdManagement.noHouseholds')}</p>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredHouseholds.map(household => {
                                const staff = getHouseholdStaff(household.id);
                                const ownerName = household.owner_user_id ? getOwnerName(household.owner_user_id) : null;

                                return (
                                    <Card key={household.id} className="border">
                                        <CardHeader className="pb-3">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <Home className="w-5 h-5 text-blue-500" />
                                                        <CardTitle className="text-lg">
                                                            {household.name}
                                                        </CardTitle>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditDetails(household)}>
                                                            <Edit className="h-4 w-4 text-gray-500 hover:text-gray-800" />
                                                        </Button>
                                                    </div>
                                                    {household.name_hebrew && <p className="text-gray-600 ml-7" style={{ direction: 'rtl' }}>{household.name_hebrew}</p>}

                                                    {household.household_code && (
                                                        <Badge variant="secondary" className="text-sm ml-7 mt-1">
                                                            #{household.household_code}
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap gap-2 self-start sm:self-center">
                                                    {/* Added Meal Calendar Button */}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleViewMealCalendar(household)}
                                                        className="text-purple-600 border-purple-300 hover:bg-purple-50"
                                                    >
                                                        <Calendar className="w-4 h-4 mr-1" />
                                                        {t('admin.householdManagement.viewMealCalendar')}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleStartShopping(household)}
                                                        className="bg-purple-50 text-purple-700 hover:bg-purple-100"
                                                    >
                                                        <ShoppingCart className="w-4 h-4 mr-1" />
                                                        {t('admin.householdManagement.shopForHousehold')}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEditAddress(household)}
                                                    >
                                                        <MapPin className="w-4 h-4 mr-1" />
                                                        {t('admin.householdManagement.address')}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEditInstructions(household)}
                                                    >
                                                        <FileVideo className="w-4 h-4 mr-1" />
                                                        {t('admin.householdManagement.instructions')}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEditKashrutPreferences(household)}
                                                    >
                                                        <Settings className="w-4 h-4 mr-1" />
                                                        {t('admin.householdManagement.kashrut')}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEditVendorPreferences(household)}
                                                    >
                                                        <Settings className="w-4 h-4 mr-1" />
                                                        {t('admin.householdManagement.vendor')}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEditStaffOrderableVendors(household)}
                                                    >
                                                        <Store className="w-4 h-4 mr-1" />
                                                        {t('admin.householdManagement.staffStores')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {/* Owner Info */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <UserIcon className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.owner')}:</span>
                                                    <span className="text-sm">
                                                        {ownerName ? ownerName : <em className="text-gray-500">{t('admin.householdManagement.notAssigned')}</em>}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditDetails(household)}
                                                    className="text-blue-600 hover:text-blue-800 p-1"
                                                >
                                                    <Edit className="w-4 h-4 mr-1" />
                                                    {t('common.edit')}
                                                </Button>
                                            </div>

                                            {/* Address Info */}
                                            <div className="flex items-start gap-2">
                                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                                <div>
                                                    <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.address')}:</span>
                                                    <p className="text-sm mt-1">
                                                        {
                                                            (() => {
                                                                const addressParts = [
                                                                    household.street,
                                                                    household.building_number,
                                                                    household.household_number,
                                                                    household.neighborhood
                                                                ].filter(Boolean);

                                                                if (addressParts.length > 0) {
                                                                    return addressParts.join(', ');
                                                                }
                                                                return <em className="text-gray-500">{t('admin.householdManagement.noAddress')}</em>;
                                                            })()
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Instructions Info */}
                                            <div className="flex items-start gap-2">
                                                <FileVideo className="w-4 h-4 text-gray-400 mt-0.5" />
                                                <div className="flex-1">
                                                    <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.instructions')}:</span>
                                                    {household.instructions || household.instructions_video_url ? (
                                                        <div className="mt-1 space-y-2">
                                                            {household.instructions && (
                                                                <p className="text-sm text-gray-600">{household.instructions}</p>
                                                            )}
                                                            {household.instructions_video_url && (
                                                                <div>
                                                                    <video
                                                                        src={household.instructions_video_url}
                                                                        controls
                                                                        className="w-full max-w-sm rounded-lg"
                                                                        style={{ maxHeight: '200px' }}
                                                                    >
                                                                        {t('common.videoNotSupported')}
                                                                    </video>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-500 italic mt-1">{t('admin.householdManagement.noInstructions')}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Kashrut Preferences */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.kashrut')}:</span>
                                                </div>
                                                {household.kashrut_preferences && household.kashrut_preferences.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {household.kashrut_preferences.map(pref => (
                                                            <Badge key={pref} variant="secondary" className="text-xs">
                                                                {getKashrutOptionName(pref)}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic">{t('admin.householdManagement.noKashrut')}</p>
                                                )}
                                            </div>
                                            {/* available vendors */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.vendor')}:</span>
                                                </div>
                                                {household.viewable_vendors && household.viewable_vendors.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {household.viewable_vendors.map(vendor => (
                                                            <Badge key={vendor.vendor_id} variant="secondary" className="text-xs">
                                                                {isRTL ? (vendor.vendor_name_hebrew || vendor.vendor_name) : vendor.vendor_name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic">{t('admin.householdManagement.noVendor')}</p>
                                                )}
                                            </div>
                                            {/* Staff Orderable Stores */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.staffStores')}:</span>
                                                </div>
                                                {household.staff_orderable_vendors && household.staff_orderable_vendors.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {household.staff_orderable_vendors.map(vendor => (
                                                            <Badge key={vendor.vendor_id} variant="outline" className="text-xs">
                                                                {isRTL ? (vendor.vendor_name_hebrew || vendor.vendor_name) : vendor.vendor_name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic">{t('admin.householdManagement.noStaffStores')}</p>
                                                )}
                                            </div>
                                            {/* Staff Members */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Briefcase className="w-4 h-4 text-gray-400" />
                                                        <span className="text-sm font-medium text-gray-700">{t('admin.householdManagement.staffMembers').replace('{{count}}', staff.length)}</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setShowStaffForm(showStaffForm === household.id ? null : household.id)}
                                                    >
                                                        <Plus className="w-4 h-4 mr-1" />
                                                        {t('admin.householdManagement.addStaff')}
                                                    </Button>
                                                </div>

                                                {staff.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {staff.map(staffMember => (
                                                            <div key={staffMember.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 rounded border gap-3">
                                                                <div>
                                                                    <span className="text-sm font-medium">{getStaffUserName(staffMember.staff_user_id)}</span>
                                                                    {staffMember.job_role && (
                                                                        <Badge variant="secondary" className="text-xs ml-2">
                                                                            {staffMember.job_role.charAt(0).toUpperCase() + staffMember.job_role.slice(1)}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 self-start sm:self-center">
                                                                    <div className="flex items-center space-x-2">
                                                                        <Switch
                                                                            checked={staffMember.can_order}
                                                                            onCheckedChange={() => handleToggleOrderPermission(staffMember.id, staffMember.can_order)}
                                                                        />
                                                                        <Label className="text-xs">{t('admin.householdManagement.canOrder')}</Label>
                                                                    </div>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleSetLead(household.id, staffMember.id)}
                                                                        disabled={staffMember.is_lead}
                                                                        className="disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        <Star className="w-4 h-4 mr-2" />
                                                                        {staffMember.is_lead ? t('admin.householdManagement.lead') : t('admin.householdManagement.setAsLead')}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleRemoveStaff(staffMember.id)}
                                                                        className="h-8 w-8 text-red-500 hover:text-red-700"
                                                                    >
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
                                                    <Select
                                                        value={newStaffData.staff_user_id}
                                                        onValueChange={(value) => setNewStaffData(prev => ({ ...prev, staff_user_id: value }))}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('admin.householdManagement.selectKCSStaff')} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {kcsUsers.map(user => (
                                                                <SelectItem key={user.id} value={user.id}>
                                                                    {user.full_name} ({user.email})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>

                                                    <Select
                                                        value={newStaffData.job_role}
                                                        onValueChange={(value) => setNewStaffData(prev => ({ ...prev, job_role: value }))}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('admin.householdManagement.selectJobRole')} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value={null}>{t('admin.householdManagement.selectJobRole')}</SelectItem>
                                                            {jobRoles.map(role => (
                                                                <SelectItem key={role} value={role}>
                                                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>

                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`can-order-${household.id}`}
                                                            checked={newStaffData.can_order}
                                                            onCheckedChange={(checked) => setNewStaffData(prev => ({ ...prev, can_order: checked }))}
                                                        />
                                                        <Label htmlFor={`can-order-${household.id}`} className="text-sm font-normal">
                                                            {t('admin.householdManagement.allowOrderPermission')}
                                                        </Label>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button size="sm" onClick={() => handleAddStaff(household.id)}>
                                                            {t('admin.householdManagement.addStaff')}
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => setShowStaffForm(null)}>
                                                            {t('admin.householdManagement.cancel')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Details Edit Dialog - New */}
                <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {t('admin.householdManagement.editDetailsTitle', { name: editingHouseholdDetails?.name })}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label htmlFor="edit-household-name-en">{t('admin.householdManagement.householdName')} (EN)</Label>
                                <Input
                                    id="edit-household-name-en"
                                    value={householdName}
                                    onChange={(e) => setHouseholdName(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="edit-household-name-he">{t('admin.householdManagement.householdName')} (HE)</Label>
                                <Input
                                    id="edit-household-name-he"
                                    value={householdNameHebrew}
                                    onChange={(e) => setHouseholdNameHebrew(e.target.value)}
                                    style={{ direction: 'rtl' }}
                                />
                            </div>
                            <div>
                                <Label htmlFor="edit-owner-select">{t('admin.householdManagement.owner')}</Label>
                                <Select value={householdOwnerId} onValueChange={setHouseholdOwnerId}>
                                    <SelectTrigger id="edit-owner-select">
                                        <SelectValue placeholder={t('admin.householdManagement.selectOwner')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={null}>{t('admin.householdManagement.noOwner')}</SelectItem>
                                        {householdOwners.map(user => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.full_name} ({user.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleSaveDetails}>
                                {t('admin.householdManagement.saveDetails')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Instructions Edit Dialog - New */}
                <Dialog open={isInstructionsDialogOpen} onOpenChange={setIsInstructionsDialogOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {t('admin.householdManagement.editInstructionsTitle', { name: editingHouseholdInstructions?.name })}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="household-instructions">{t('admin.householdManagement.textInstructions')}</Label>
                                <Textarea
                                    id="household-instructions"
                                    placeholder={t('admin.householdManagement.instructionsPlaceholder')}
                                    value={householdInstructions}
                                    onChange={(e) => setHouseholdInstructions(e.target.value)}
                                    rows={4}
                                />
                            </div>

                            <div>
                                <Label htmlFor="video-upload">{t('admin.householdManagement.videoInstructions')}</Label>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="video-upload"
                                            type="file"
                                            accept="video/*"
                                            onChange={handleVideoUpload}
                                            disabled={isUploadingVideo}
                                            className="hidden"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => document.getElementById('video-upload').click()}
                                            disabled={isUploadingVideo}
                                        >
                                            {isUploadingVideo ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                                            ) : (
                                                <Upload className="w-4 h-4 mr-2" />
                                            )}
                                            {isUploadingVideo ? t('admin.householdManagement.uploading') : t('admin.householdManagement.uploadVideo')}
                                        </Button>
                                        {householdInstructionsVideo && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => setHouseholdInstructionsVideo("")}
                                            >
                                                {t('admin.householdManagement.removeVideo')}
                                            </Button>
                                        )}
                                    </div>

                                    {householdInstructionsVideo && (
                                        <div>
                                            <video
                                                src={householdInstructionsVideo}
                                                controls
                                                className="w-full max-w-md rounded-lg"
                                                style={{ maxHeight: '200px' }}
                                            >
                                                {t('common.videoNotSupported')}
                                            </video>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {t('admin.householdManagement.videoHelpText')}
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsInstructionsDialogOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleSaveInstructions} disabled={isUploadingVideo}>
                                {t('admin.householdManagement.saveInstructions')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Kashrut Preferences Dialog */}
                <Dialog open={isKashrutDialogOpen} onOpenChange={setIsKashrutDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {t('admin.householdManagement.kashrutPrefsTitle', { name: editingHousehold?.name })}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                {t('admin.householdManagement.kashrutHelpText')}
                            </p>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {kashrutOptions.map(option => (
                                    <div key={option.id} className="flex items-center space-x-3 p-2 border rounded">
                                        <Checkbox
                                            id={`kashrut-${option.id}`}
                                            checked={selectedKashrutPreferences.includes(option.value)}
                                            onCheckedChange={(checked) => handleKashrutPreferenceChange(option.value, checked)}
                                        />
                                        <Label htmlFor={`kashrut-${option.id}`} className="flex-1">
                                            <span className="font-medium">{option.name}</span>
                                            {option.name_hebrew && (
                                                <span className="text-gray-600 mr-2" style={{ direction: 'rtl' }}>
                                                    ({option.name_hebrew})
                                                </span>
                                            )}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsKashrutDialogOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleSaveKashrutPreferences}>
                                {t('admin.householdManagement.savePreferences')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>

            {/* available vendor stores */}
            <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {t('admin.householdManagement.availableVendorTitle', { name: editingHousehold?.name })}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {vendors.map(option => (
                                <div key={option.id} className="flex items-center space-x-3 p-2 border rounded">
                                    <Checkbox
                                        id={`vendor-${option.id}`}
                                        checked={selectedVendorPreferences.includes(option.id)}
                                        onCheckedChange={(checked) => handleVendorPreferenceChange(option.id, checked)}
                                    />
                                    <Label htmlFor={`vendor-${option.id}`} className="flex-1">
                                        <span className="font-medium">{option.name}</span>
                                        {option.name_hebrew && (
                                            <span className="text-gray-600 mr-2" style={{ direction: 'rtl' }}>
                                                ({option.name_hebrew})
                                            </span>
                                        )}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsVendorDialogOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSaveVendorPreferences}>
                            {t('admin.householdManagement.savePreferences')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Staff Orderable Stores Dialog */}
            <Dialog open={isStaffVendorDialogOpen} onOpenChange={setIsStaffVendorDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {t('admin.householdManagement.staffStoresTitle', { name: editingHousehold?.name })}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            {t('admin.householdManagement.staffStoresHelpText')}
                        </p>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {vendors.map(vendor => (
                                <div key={vendor.id} className="flex items-center space-x-3 p-2 border rounded">
                                    <Checkbox
                                        id={`staff-vendor-${vendor.id}`}
                                        checked={selectedStaffOrderableVendors.includes(vendor.id)}
                                        onCheckedChange={(checked) => handleStaffOrderableVendorChange(vendor.id, checked)}
                                    />
                                    <Label htmlFor={`staff-vendor-${vendor.id}`} className="flex-1">
                                        <span className="font-medium">{vendor.name}</span>
                                        {vendor.name_hebrew && (
                                            <span className="text-gray-600 mr-2" style={{ direction: 'rtl' }}>
                                                ({vendor.name_hebrew})
                                            </span>
                                        )}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsStaffVendorDialogOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSaveStaffOrderableVendors}>
                            {t('admin.householdManagement.savePreferences')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Address Edit Modal - New component */}
            <AddressEditModal
                household={editingHouseholdAddress}
                isOpen={!!editingHouseholdAddress}
                onClose={() => setEditingHouseholdAddress(null)}
                onSave={handleSaveAddress}
                t={t} // Pass translation function to the modal if needed
            />
        </Card>
    );
}