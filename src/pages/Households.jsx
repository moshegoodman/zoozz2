
import React, { useState, useEffect } from "react";
import { Household, User, HouseholdStaff } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Home, Plus, User as UserIcon, Users, Briefcase, ShoppingCart } from "lucide-react";

export default function HouseholdsPage() {
    const [households, setHouseholds] = useState([]);
    const [householdStaff, setHouseholdStaff] = useState([]);
    const [kcsUsers, setKcsUsers] = useState([]);
    const [newHouseholdName, setNewHouseholdName] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [showStaffForm, setShowStaffForm] = useState(null);
    const [newStaffData, setNewStaffData] = useState({
        staff_user_id: "",
        job_role: "",
        can_order: false
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [householdData, staffData, allUsers] = await Promise.all([
                Household.list("-created_date"),
                HouseholdStaff.list("-created_date"),
                User.list()
            ]);
            
            setHouseholds(householdData);
            setHouseholdStaff(staffData);
            // Filter only KCS users for staff assignments
            setKcsUsers(allUsers.filter(user => user.user_type === 'customerKCS'));
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateHousehold = async () => {
        if (!newHouseholdName.trim()) {
            alert("Please enter a household name.");
            return;
        }

        setIsCreating(true);
        try {
            let currentUser = null;
            try {
                currentUser = await User.me();
            } catch (e) {
                // User is not logged in, proceed without an owner
            }

            const householdData = {
                name: newHouseholdName,
                // Only set owner_user_id if a user is logged in
                ...(currentUser && { owner_user_id: currentUser.id })
            };

            await Household.create(householdData);
            setNewHouseholdName("");
            await loadData(); // Refresh all data
        } catch (error) {
            console.error("Error creating household:", error);
            alert("Failed to create household.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleAddStaff = async (householdId) => {
        if (!newStaffData.staff_user_id) {
            alert("Please select a staff member.");
            return;
        }

        try {
            await HouseholdStaff.create({
                household_id: householdId,
                staff_user_id: newStaffData.staff_user_id,
                job_role: newStaffData.job_role,
                can_order: newStaffData.can_order
            });
            
            setNewStaffData({ staff_user_id: "", job_role: "", can_order: false });
            setShowStaffForm(null);
            await loadData(); // Refresh data
        } catch (error) {
            console.error("Error adding staff:", error);
            alert("Failed to add staff member.");
        }
    };

    const getHouseholdStaff = (householdId) => {
        return householdStaff.filter(staff => staff.household_id === householdId);
    };

    const getStaffUserName = (userId) => {
        const user = kcsUsers.find(u => u.id === userId);
        return user ? user.full_name : 'Unknown User';
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
                    <Users className="w-8 h-8 mr-3 text-green-600" />
                    Manage Households
                </h1>

                {/* Create Household Form */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Create a New Household</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <Label htmlFor="household-name">Household Name</Label>
                                <Input
                                    id="household-name"
                                    placeholder="e.g., The Smith Family"
                                    value={newHouseholdName}
                                    onChange={(e) => setNewHouseholdName(e.target.value)}
                                    disabled={isCreating}
                                />
                            </div>
                            <Button onClick={handleCreateHousehold} disabled={isCreating} className="self-end sm:self-auto mt-4 sm:mt-0">
                                {isCreating ? "Creating..." : <><Plus className="w-4 h-4 mr-2" /> Create</>}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Households List */}
                <div>
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Existing Households</h2>
                    {isLoading ? (
                        <p>Loading households...</p>
                    ) : households.length === 0 ? (
                        <Card className="text-center py-8">
                            <CardContent>
                                <Home className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600">No households have been created yet.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {households.map(household => {
                                const staff = getHouseholdStaff(household.id);
                                return (
                                    <Card key={household.id}>
                                        <CardHeader>
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="flex items-center gap-2">
                                                    <Home className="w-5 h-5 text-gray-500" />
                                                    {household.name}
                                                </CardTitle>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => setShowStaffForm(household.id)}
                                                >
                                                    <Plus className="w-4 h-4 mr-1" /> Add Staff
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {/* Owner Info */}
                                            <div className="text-sm text-gray-600 flex items-center gap-2">
                                                <UserIcon className="w-4 h-4 text-gray-400" />
                                                Owner: {household.owner_user_id ? 
                                                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{household.owner_user_id}</span> : 
                                                    <span className="italic">None assigned</span>
                                                }
                                            </div>

                                            {/* Staff Members */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Briefcase className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm font-medium text-gray-700">Staff Members ({staff.length})</span>
                                                </div>
                                                {staff.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {staff.map(staffMember => (
                                                            <div key={staffMember.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                                <span className="text-sm">{getStaffUserName(staffMember.staff_user_id)}</span>
                                                                <div className="flex items-center gap-2">
                                                                    {staffMember.job_role && (
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            {staffMember.job_role}
                                                                        </Badge>
                                                                    )}
                                                                    {staffMember.can_order && (
                                                                        <Badge className="bg-green-100 text-green-800 text-xs border border-green-200">
                                                                            <ShoppingCart className="w-3 h-3 mr-1" />
                                                                            Can Order
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic">No staff assigned</p>
                                                )}
                                            </div>

                                            {/* Add Staff Form */}
                                            {showStaffForm === household.id && (
                                                <div className="border-t pt-4 space-y-3">
                                                    <Label>Add Staff Member</Label>
                                                    <Select 
                                                        value={newStaffData.staff_user_id} 
                                                        onValueChange={(value) => setNewStaffData(prev => ({...prev, staff_user_id: value}))}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select KCS customer..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {kcsUsers.map(user => (
                                                                <SelectItem key={user.id} value={user.id}>
                                                                    {user.full_name} ({user.email})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        placeholder="Job/Role (optional)"
                                                        value={newStaffData.job_role}
                                                        onChange={(e) => setNewStaffData(prev => ({...prev, job_role: e.target.value}))}
                                                    />
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`can-order-${household.id}`}
                                                            checked={newStaffData.can_order}
                                                            onCheckedChange={(checked) => setNewStaffData(prev => ({...prev, can_order: checked}))}
                                                        />
                                                        <Label htmlFor={`can-order-${household.id}`} className="text-sm font-normal">
                                                            Allow staff to place orders for this household
                                                        </Label>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button size="sm" onClick={() => handleAddStaff(household.id)}>
                                                            Add
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => setShowStaffForm(null)}>
                                                            Cancel
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
            </div>
        </div>
    );
}
