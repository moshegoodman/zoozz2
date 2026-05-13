import React, { useState } from "react";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";

export function AREntryModal({ isOpen, onClose, onSuccess, households }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    household_id: "",
    amount: "",
    currency: "ILS",
    date: new Date().toISOString().split("T")[0],
    payment_method: "wire_transfer",
    reference_number: "",
    description: "",
    is_approved: false,
  });

  const selectedHousehold = households.find(h => h.id === formData.household_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.household_id || !formData.amount) return;

    setLoading(true);
    try {
      await base44.entities.AR.create({
        ...formData,
        household_name: selectedHousehold?.name || "",
        amount: parseFloat(formData.amount),
        season: selectedHousehold?.season || "",
      });
      onSuccess?.();
      setFormData({
        household_id: "",
        amount: "",
        currency: "ILS",
        date: new Date().toISOString().split("T")[0],
        payment_method: "wire_transfer",
        reference_number: "",
        description: "",
        is_approved: false,
      });
      onClose();
    } catch (err) {
      console.error("Error creating AR record:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Payment Received</h2>
          <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Household *</label>
            <select
              value={formData.household_id}
              onChange={e => setFormData({ ...formData, household_id: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              required
            >
              <option value="">— Select Household —</option>
              {households.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Currency</label>
            <select
              value={formData.currency}
              onChange={e => setFormData({ ...formData, currency: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="ILS">ILS</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
            <select
              value={formData.payment_method}
              onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="wire_transfer">Wire Transfer</option>
              <option value="check">Check</option>
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
              <option value="zelle">Zelle</option>
              <option value="venmo">Venmo</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Reference Number</label>
            <input
              type="text"
              value={formData.reference_number}
              onChange={e => setFormData({ ...formData, reference_number: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder="Check #, Wire ref, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              rows="2"
              placeholder="Notes..."
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="approved"
              checked={formData.is_approved}
              onChange={e => setFormData({ ...formData, is_approved: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label htmlFor="approved" className="text-xs font-medium text-gray-700">Mark as approved</label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.household_id || !formData.amount}
              className="flex-1 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
            >
              {loading ? "Saving..." : "Add Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}