import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, TestTube2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function PriorityAPISettings() {
  const [settings, setSettings] = useState({
    priority_api_url: '',
    priority_api_username: '',
    priority_api_password: ''
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [message, setMessage] = useState('');

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsList = await base44.entities.AppSettings.list();
        if (settingsList?.length > 0) {
          const appSettings = settingsList[0];
          setSettings({
            priority_api_url: appSettings.priority_api_url || '',
            priority_api_username: appSettings.priority_api_username || '',
            priority_api_password: appSettings.priority_api_password || ''
          });
        }
      } catch (e) {
        console.error('Error loading Priority API settings:', e);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const settingsList = await base44.entities.AppSettings.list();
      if (settingsList?.length > 0) {
        await base44.entities.AppSettings.update(settingsList[0].id, settings);
        setMessage('Priority API settings saved successfully!');
      } else {
        await base44.entities.AppSettings.create(settings);
        setMessage('Priority API settings created successfully!');
      }
    } catch (e) {
      console.error('Error saving Priority API settings:', e);
      setMessage(`Error saving settings: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (!settings.priority_api_url) {
        setTestResult({ success: false, message: 'Please enter the Priority API URL' });
        return;
      }
      if (!settings.priority_api_username) {
        setTestResult({ success: false, message: 'Please enter the Priority API username' });
        return;
      }
      if (!settings.priority_api_password) {
        setTestResult({ success: false, message: 'Please enter the Priority API password' });
        return;
      }

      // Test connection by making a simple API call
      const response = await fetch(`${settings.priority_api_url}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(`${settings.priority_api_username}:${settings.priority_api_password}`)
        }
      });

      if (response.ok) {
        setTestResult({ 
          success: true, 
          message: 'Successfully connected to Priority API!',
          status: response.status
        });
      } else {
        setTestResult({ 
          success: false, 
          message: `Connection failed with status ${response.status}: ${response.statusText}`,
          status: response.status
        });
      }
    } catch (e) {
      console.error('Error testing Priority API connection:', e);
      setTestResult({ 
        success: false, 
        message: `Connection error: ${e.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-lg">Priority ERP API Integration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {message && (
          <div className={`p-3 rounded-lg ${message.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="priority_api_url" className="block mb-2">
              API Service Root URL
            </Label>
            <Input
              id="priority_api_url"
              placeholder="e.g., https://t.eu.priority-connect.online/odata/Priority/tabbtd38.ini/usdemo"
              value={settings.priority_api_url}
              onChange={(e) => setSettings({ ...settings, priority_api_url: e.target.value })}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              The base URL for your Priority OData service. Contact your system administrator if unsure.
            </p>
          </div>

          <div>
            <Label htmlFor="priority_api_username" className="block mb-2">
              Username
            </Label>
            <Input
              id="priority_api_username"
              type="text"
              placeholder="API username"
              value={settings.priority_api_username}
              onChange={(e) => setSettings({ ...settings, priority_api_username: e.target.value })}
              className="w-full"
            />
          </div>

          <div>
            <Label htmlFor="priority_api_password" className="block mb-2">
              Password
            </Label>
            <Input
              id="priority_api_password"
              type="password"
              placeholder="API password"
              value={settings.priority_api_password}
              onChange={(e) => setSettings({ ...settings, priority_api_password: e.target.value })}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>

          <Button
            onClick={handleTest}
            disabled={testing}
            variant="outline"
          >
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube2 className="w-4 h-4 mr-2" />}
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>

        {testResult && (
          <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className={`font-semibold mb-1 ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
              {testResult.success ? '✓ Success' : '✗ Failed'}
            </div>
            <p className={testResult.success ? 'text-green-600' : 'text-red-600'}>
              {testResult.message}
            </p>
            {testResult.status && (
              <p className="text-xs text-gray-500 mt-2">
                Status Code: {testResult.status}
              </p>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="font-semibold text-blue-900 mb-2">About Priority API</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Priority is an OData-based REST API</li>
            <li>• Requires basic authentication (username/password)</li>
            <li>• Service root URL is specific to your Priority installation</li>
            <li>• API calls are rate-limited to 100 calls per minute</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}