import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { household_id, season_id } = await req.json();
    if (!household_id || !season_id) {
      return Response.json({ error: 'household_id and season_id are required' }, { status: 400 });
    }

    // Fetch all data in parallel
    const [householdsArr, seasonsArr, profilesArr, calendarsArr, menusArr] = await Promise.all([
      base44.asServiceRole.entities.Household.filter({ id: household_id }),
      base44.asServiceRole.entities.MenuSeason.filter({ id: season_id }),
      base44.asServiceRole.entities.ClientMenuProfile.filter({ household_id, season_id }),
      base44.asServiceRole.entities.HouseholdSeasonCalendar.filter({ household_id, season_id }),
      base44.asServiceRole.entities.Menu.filter({ household_id, season_id }),
    ]);

    const household = householdsArr?.[0];
    const season = seasonsArr?.[0];
    const profile = profilesArr?.[0];
    const calendar = calendarsArr?.[0];
    const menus = menusArr || [];

    if (!household || !season) {
      return Response.json({ error: 'Household or season not found' }, { status: 404 });
    }

    // Build a map of menu_id -> menu for quick lookup
    const menuMap = {};
    menus.forEach(m => { menuMap[m.id] = m; });

    // Style helpers
    const MEAL_STYLE_LABEL = { plated: 'Plated', family_style: 'Family Style', buffet: 'Buffet' };
    const hex = (color) => color || '#222';

    // Build calendar days sorted by date, only those in the season range
    const calDays = (calendar?.calendar_days || [])
      .filter(d => d.date >= season.start_date && d.date <= season.end_date)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Format a date like "Friday, Apr 18"
    function fmtDate(iso) {
      const [y, m, d] = iso.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
    }

    // Allergy banner
    const allergyBanner = profile?.allergy_header
      ? `<div style="background:#fff3cd;border:2px solid #f59e0b;border-radius:8px;padding:10px 16px;margin-bottom:18px;font-size:13px;color:#92400e;">
          <strong>⚠️ Allergy Notice:</strong> ${profile.allergy_header}
         </div>`
      : '';

    // Meal structure section
    const mealStructureRows = [
      { label: 'Dinner', style: profile?.dinner_style, courses: profile?.dinner_courses },
      { label: 'Lunch', style: profile?.lunch_style, courses: profile?.lunch_courses },
      { label: 'Kiddush', style: profile?.kiddush_style, courses: profile?.kiddush_courses },
    ];

    const mealStructureHtml = mealStructureRows.map(({ label, style, courses }) => {
      if (!courses?.length && !style) return '';
      const courseRows = (courses || []).map(course => {
        const dishList = (course.dishes || []).map(d =>
          `<li style="margin:2px 0;font-size:12px;">${d.english || ''}${d.hebrew ? ` <span style="color:#666;">(${d.hebrew})</span>` : ''}</li>`
        ).join('');
        return `<div style="margin-bottom:8px;">
          <div style="font-weight:600;font-size:12px;color:#444;border-bottom:1px solid #eee;padding-bottom:2px;margin-bottom:4px;">${course.title_english || ''}${course.title_hebrew ? ` / ${course.title_hebrew}` : ''}</div>
          <ul style="margin:0;padding-left:18px;">${dishList}</ul>
        </div>`;
      }).join('');
      return `<tr>
        <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #f0f0f0;font-weight:700;font-size:13px;white-space:nowrap;color:#1a1a1a;">${label}</td>
        <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;">${MEAL_STYLE_LABEL[style] || ''}</td>
        <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #f0f0f0;">${courseRows || '<span style="color:#aaa;font-size:12px;">No courses defined</span>'}</td>
      </tr>`;
    }).filter(Boolean).join('');

    // Weekly calendar section
    const calendarHtml = calDays.map(day => {
      const meals = day.assigned_meals || [];
      if (!meals.length) return '';

      const mealRows = meals.map(meal => {
        const menu = meal.menu_id ? menuMap[meal.menu_id] : null;
        const coursesHtml = menu?.courses?.length
          ? menu.courses.map(course => {
              const dishes = (course.dishes || []).map(d =>
                `<li style="margin:2px 0;font-size:11px;">${d.english || d.hebrew || ''}</li>`
              ).join('');
              return `<div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#555;">${course.title_english || ''}</div>
                <ul style="margin:2px 0;padding-left:14px;">${dishes}</ul>
              </div>`;
            }).join('')
          : '<span style="font-size:11px;color:#aaa;">Menu not yet drafted</span>';

        return `<tr>
          <td style="padding:6px 10px;vertical-align:top;border-bottom:1px solid #f5f5f5;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${hex(meal.color)};margin-right:6px;vertical-align:middle;"></span>
            <strong style="font-size:12px;">${meal.meal_type_name || ''}</strong>
            ${meal.time ? `<div style="font-size:10px;color:#888;margin-left:16px;">🕐 ${meal.time}</div>` : ''}
          </td>
          <td style="padding:6px 10px;vertical-align:top;border-bottom:1px solid #f5f5f5;">${coursesHtml}</td>
        </tr>`;
      }).join('');

      return `<div style="margin-bottom:14px;break-inside:avoid;">
        <div style="background:#f7f7f7;border-left:4px solid #d97706;padding:6px 12px;border-radius:4px 0 0 4px;margin-bottom:0;">
          <span style="font-weight:700;font-size:13px;color:#1a1a1a;">${fmtDate(day.date)}</span>
          ${day.hebrew_date ? `<span style="color:#777;font-size:11px;margin-left:8px;">${day.hebrew_date}</span>` : ''}
          ${day.holiday ? `<span style="color:#059669;font-size:11px;font-weight:600;margin-left:8px;">• ${day.holiday}</span>` : ''}
          ${day.candle_lighting ? `<span style="color:#dc2626;font-size:10px;margin-left:8px;">🕯 ${day.candle_lighting}</span>` : ''}
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-top:none;border-radius:0 0 4px 4px;">
          <colgroup><col style="width:160px"><col></colgroup>
          ${mealRows}
        </table>
      </div>`;
    }).filter(Boolean).join('');

    // Kashrut & dietary
    const dietHtml = [
      profile?.kashrut ? `<div><strong>Kashrut:</strong> ${profile.kashrut}</div>` : '',
      profile?.dietary_restrictions ? `<div><strong>Dietary Restrictions:</strong> ${profile.dietary_restrictions}</div>` : '',
      profile?.has_allergy && profile?.allergy_who ? `<div><strong>Allergy:</strong> ${profile.allergy_who} — ${profile.allergy_what || ''}</div>` : '',
    ].filter(Boolean).join('');

    const staffHtml = [
      profile?.staff_chef_name ? `Chef: ${profile.staff_chef_name}` : (profile?.staff_chef_qty ? `Chef ×${profile.staff_chef_qty}` : ''),
      profile?.staff_cook_name ? `Cook: ${profile.staff_cook_name}` : (profile?.staff_cook_qty ? `Cook ×${profile.staff_cook_qty}` : ''),
      profile?.staff_house_manager_name ? `House Mgr: ${profile.staff_house_manager_name}` : '',
      profile?.staff_waiter_name ? `Waiter: ${profile.staff_waiter_name}` : '',
    ].filter(Boolean).join(' &nbsp;|&nbsp; ');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Chef Menu Pack — ${household.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; color: #1a1a1a; background: #fff; font-size: 13px; }
  .page { max-width: 900px; margin: 0 auto; padding: 32px 32px; }
  h1 { font-size: 22px; font-weight: 800; color: #1a1a1a; }
  h2 { font-size: 15px; font-weight: 700; color: #374151; margin: 22px 0 10px; border-bottom: 2px solid #d97706; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #d97706;">
    <div>
      <h1>${household.name}${household.name_hebrew ? ` <span style="color:#777;font-size:16px;">${household.name_hebrew}</span>` : ''}</h1>
      <div style="color:#555;font-size:12px;margin-top:4px;">
        ${season.name} &nbsp;·&nbsp; ${season.start_date} – ${season.end_date}
        ${profile?.location_of_event ? ` &nbsp;·&nbsp; 📍 ${profile.location_of_event}` : ''}
      </div>
      ${staffHtml ? `<div style="color:#777;font-size:11px;margin-top:4px;">${staffHtml}</div>` : ''}
    </div>
    <div style="text-align:right;font-size:11px;color:#999;">
      Chef Menu Pack<br>Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
    </div>
  </div>

  ${allergyBanner}

  ${dietHtml ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;margin-bottom:18px;font-size:12px;color:#166534;">${dietHtml}</div>` : ''}

  <!-- Meal Structure Blueprint -->
  ${mealStructureHtml ? `
  <h2>🍽 Meal Structure Blueprint</h2>
  <table style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
    <thead>
      <tr style="background:#fef3c7;">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#92400e;width:80px;">Meal</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#92400e;width:110px;">Style</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#92400e;">Courses & Dishes</th>
      </tr>
    </thead>
    <tbody>${mealStructureHtml}</tbody>
  </table>` : ''}

  <!-- Weekly Calendar & Menus -->
  ${calendarHtml ? `
  <h2>📅 Season Calendar & Menus</h2>
  ${calendarHtml}` : `<div style="color:#aaa;font-size:13px;margin-top:16px;">No calendar days found for this household.</div>`}

  <!-- Notes -->
  ${profile?.staff_notes ? `
  <h2>📝 Chef Notes</h2>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;font-size:12px;white-space:pre-wrap;">${profile.staff_notes}</div>` : ''}

  ${profile?.special_requests ? `
  <h2>⭐ Special Requests</h2>
  <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:6px;padding:12px 14px;font-size:12px;white-space:pre-wrap;">${profile.special_requests}</div>` : ''}

</div>
</body>
</html>`;

    // Use PDFShift to generate
    const pdfShiftKey = Deno.env.get('PDFSHIFT_API_KEY');
    const pdfRes = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`api:${pdfShiftKey}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: html, landscape: false, use_print: true }),
    });

    if (!pdfRes.ok) {
      const err = await pdfRes.text();
      return Response.json({ error: 'PDF generation failed', detail: err }, { status: 500 });
    }

    const pdfBytes = await pdfRes.arrayBuffer();
    const filename = `chef-menu-${household.name.replace(/\s+/g, '-')}-${season.code || season.name}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});