import React, { useState } from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MobileBottomSheet from '@/components/mobile/MobileBottomSheet';

/**
 * DeleteAccountDialog – mobile-native account deletion flow
 * 
 * Props:
 *   isOpen       – boolean to control visibility
 *   onClose      – callback to close
 *   onConfirm    – async callback when user confirms deletion
 *   isLoading    – boolean to show loading state
 */
export default function DeleteAccountDialog({ isOpen, onClose, onConfirm, isLoading }) {
  const [confirmText, setConfirmText] = useState('');

  const handleConfirm = async () => {
    if (confirmText !== 'DELETE') return;
    setConfirmText('');
    await onConfirm();
    onClose();
  };

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title="Delete Account"
      snapPoints={['60vh', '90vh']}
    >
      <div className="space-y-4">
        {/* Warning banner */}
        <div className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-semibold mb-1">This action cannot be undone</p>
            <p>Your account and all associated data will be permanently deleted.</p>
          </div>
        </div>

        {/* Confirmation input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded">DELETE</span> to confirm
          </label>
          <Input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="min-h-[44px]"
            disabled={isLoading}
            autoComplete="off"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirmText !== 'DELETE' || isLoading}
            className="flex-1 min-h-[44px] bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </>
            )}
          </Button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}