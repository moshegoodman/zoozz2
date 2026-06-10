import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, AlertTriangle, CheckCircle2, Search } from "lucide-react";

/**
 * Diagnostic view: lists season-tagged KCSPayments that DO NOT appear in the
 * Payroll Summary, with the specific reason each is excluded.
 *
 * Mirrors the PayrollSummary filtering rules:
 *  - Payment must be active (is_active !== false)
 *  - Payment.employee_user_id must resolve to a known User
 *  - That user must have a HouseholdStaff link to a Household whose season
 *    matches the payment's season tag (this is how PayrollSummary's "Israel/America"
 *    tabs determine which users show up).
 *  - Country (Israel vs America) of the linked household.
 */
export default function PaymentsAuditView() {
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [householdStaff, setHouseholdStaff] = useState([]);
  const [seasonFilter, setSeasonFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [p, u, h, hs] = await Promise.all([
        base44.entities.KCSPayment.list("-payment_date", 5000),
        base44.entities.User.list("-created_date", 5000),
        base44.entities.Household.list("-created_date", 5000),
        base44.entities.HouseholdStaff.list("-created_date", 5000),
      ]);
      setPayments(p || []);
      setUsers(u || []);
      setHouseholds(h || []);
      setHouseholdStaff(hs || []);
    } catch (err) {
      console.error("PaymentsAuditView load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const usersById = useMemo(() => {
    const m = new Map();
    users.forEach(u => m.set(u.id, u));
    return m;
  }, [users]);

  const householdsById = useMemo(() => {
    const m = new Map();
    households.forEach(h => m.set(h.id, h));
    return m;
  }, [households]);

  // For each user, the set of seasons they're linked to via HouseholdStaff
  const userSeasonsByUserId = useMemo(() => {
    const m = new Map(); // userId -> Set of season codes (upper)
    householdStaff.forEach(hs => {
      if (!hs.staff_user_id || !hs.household_id) return;
      const hh = householdsById.get(hs.household_id);
      if (!hh) return;
      const season = (hh.season || "").toUpperCase();
      if (!season) return;
      if (!m.has(hs.staff_user_id)) m.set(hs.staff_user_id, new Set());
      m.get(hs.staff_user_id).add(season);
    });
    return m;
  }, [householdStaff, householdsById]);

  const availableSeasons = useMemo(() => {
    const set = new Set();
    payments.forEach(p => { if (p.season) set.add(p.season.toUpperCase()); });
    return Array.from(set).sort();
  }, [payments]);

  // Identify excluded season-tagged payments + the reason
  const excludedRows = useMemo(() => {
    const rows = [];
    payments.forEach(p => {
      if (!p.season) return; // only audit tagged ones
      const seasonKey = p.season.toUpperCase();
      if (seasonFilter && seasonFilter !== seasonKey) return;

      const reasons = [];

      if (p.is_active === false) {
        reasons.push("Payment is soft-deleted (is_active = false)");
      }

      const user = usersById.get(p.employee_user_id);
      if (!p.employee_user_id) {
        reasons.push("No employee_user_id on payment");
      } else if (!user) {
        reasons.push(`Employee user not found (id=${p.employee_user_id})`);
      }

      if (user) {
        const userSeasons = userSeasonsByUserId.get(user.id);
        if (!userSeasons || userSeasons.size === 0) {
          reasons.push("User has NO HouseholdStaff links (won't appear in any payroll tab)");
        } else if (!userSeasons.has(seasonKey)) {
          reasons.push(
            `User has HouseholdStaff links only for seasons [${Array.from(userSeasons).join(", ")}] — NOT for ${seasonKey}`
          );
        }
      }

      if (reasons.length === 0) return; // payment IS included — skip

      // Country breakdown of the user's linked households (helps tell which tab they appear under)
      const linkedHouseholds = householdStaff
        .filter(hs => hs.staff_user_id === p.employee_user_id)
        .map(hs => householdsById.get(hs.household_id))
        .filter(Boolean);
      const countries = Array.from(new Set(
        linkedHouseholds.map(h => (h.country || "").toLowerCase().trim() || "(none)")
      ));

      rows.push({
        payment: p,
        user,
        reasons,
        countries,
      });
    });
    return rows.sort((a, b) => (b.payment.payment_date || "").localeCompare(a.payment.payment_date || ""));
  }, [payments, seasonFilter, usersById, userSeasonsByUserId, householdStaff, householdsById]);

  const totalTaggedInScope = useMemo(() => {
    return payments.filter(p =>
      p.season && (!seasonFilter || p.season.toUpperCase() === seasonFilter)
    ).length;
  }, [payments, seasonFilter]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-3">
          <span className="flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-600" />
            Payroll Summary — Missing Payments Audit
          </span>
          <Button size="sm" variant="outline" onClick={loadAll}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Season-tagged payments that are <strong>excluded</strong> from the Payroll Summary, with the reason for each.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700">Season:</label>
          <Select value={seasonFilter || "__all__"} onValueChange={(v) => setSeasonFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All seasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All seasons</SelectItem>
              {availableSeasons.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              Tagged payments in scope: <strong>{totalTaggedInScope}</strong>
            </span>
            <span className={excludedRows.length > 0 ? "text-amber-700 font-semibold" : "text-green-700 font-semibold"}>
              Excluded: {excludedRows.length}
            </span>
          </div>
        </div>

        {excludedRows.length === 0 ? (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            <CheckCircle2 className="w-5 h-5" />
            <span>All season-tagged payments in scope are included in the Payroll Summary.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-2 font-semibold">ID</th>
                  <th className="text-left p-2 font-semibold">Date</th>
                  <th className="text-left p-2 font-semibold">Employee</th>
                  <th className="text-right p-2 font-semibold">Amount</th>
                  <th className="text-left p-2 font-semibold">Season</th>
                  <th className="text-left p-2 font-semibold">Linked Countries</th>
                  <th className="text-left p-2 font-semibold">Reason Excluded</th>
                </tr>
              </thead>
              <tbody>
                {excludedRows.map(({ payment, user, reasons, countries }) => (
                  <tr key={payment.id} className="border-b border-gray-100 hover:bg-amber-50/30">
                    <td className="p-2 font-mono text-xs text-gray-500">
                      #{payment.running_id ?? payment.id.slice(-6)}
                    </td>
                    <td className="p-2 whitespace-nowrap">{payment.payment_date || "—"}</td>
                    <td className="p-2">
                      {payment.employee_name || user?.full_name || user?.email || (
                        <span className="text-red-600">(unknown)</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-medium whitespace-nowrap">
                      {payment.currency === "USD" ? "$" : "₪"}
                      {Number(payment.amount || 0).toFixed(2)}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-xs">{payment.season}</Badge>
                    </td>
                    <td className="p-2 text-xs text-gray-600">
                      {countries.length > 0 ? countries.join(", ") : "—"}
                    </td>
                    <td className="p-2">
                      <ul className="space-y-1">
                        {reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}