import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function LocalDevLogin() {
    const { t } = useLanguage();
    const [users, setUsers] = useState([]);
    const [selectedUserEmail, setSelectedUserEmail] = useState('');
    const [currentUserEmail, setCurrentUserEmail] = useState(null);

    useEffect(() => {
        async function loadUsers() {
            try {
                const allUsers = await User.list();
                setUsers(allUsers);
            } catch (error) {
                console.error("Failed to load users for dev login:", error);
            }
        }
        
        loadUsers();
        const storedEmail = localStorage.getItem('local_dev_user_email');
        if (storedEmail) {
            setCurrentUserEmail(storedEmail);
        }
    }, []);

    const handleLogin = () => {
        if (selectedUserEmail) {
            localStorage.setItem('local_dev_user_email', selectedUserEmail);
            window.location.reload();
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('local_dev_user_email');
        window.location.reload();
    };
    
    return (
        <div className="fixed bottom-4 left-4 z-[100] bg-white/80 backdrop-blur-md p-3 rounded-lg shadow-2xl border border-gray-200">
            <h4 className="font-bold text-sm mb-2 text-gray-700 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-purple-600" />
                {t('localDev.title')}
            </h4>
            {currentUserEmail ? (
                <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-600">
                        {t('localDev.loggedInAs')}: <strong className="font-mono">{currentUserEmail}</strong>
                    </p>
                    <Button variant="outline" size="sm" onClick={handleLogout} className="h-7">
                        <LogOut className="w-3 h-3 mr-1" /> {t('localDev.logout')}
                    </Button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <Select onValueChange={setSelectedUserEmail}>
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                            <SelectValue placeholder={t('localDev.selectUser')} />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map(user => (
                                <SelectItem key={user.id} value={user.email} className="text-xs">
                                    {user.email} ({user.user_type || 'N/A'})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleLogin} size="sm" className="bg-purple-600 hover:bg-purple-700 h-8">
                        <LogIn className="w-3 h-3 mr-1" /> {t('localDev.login')}
                    </Button>
                </div>
            )}
             <p className="text-xs text-gray-400 mt-2">{t('localDev.description')}</p>
        </div>
    );
}