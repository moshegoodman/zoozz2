import { createClient } from 'npm:@base44/sdk@0.1.0';
import { getTranslations } from './utils/translationHelper.js';
import { format } from "npm:date-fns";

const base44 = createClient({ appId: Deno.env.get('BASE44_APP_ID') });

Deno.serve(async (req) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return new Response('Unauthorized', { status: 401 });
        base44.auth.setToken(authHeader.split(' ')[1]);

        const { shoppingList, vendorName, language } = await req.json();

        // Fetch font settings
        const settingsData = await base44.entities.AppSettings.filter({}, null, 1);
        const appSettings = settingsData.length > 0 ? settingsData[0] : {};

        const isHebrew = language === 'Hebrew';
        const t = getTranslations(language);

        const fontFace = (appSettings.hebrewFontUrlRegular && appSettings.hebrewFontUrlBold)
            ? `
            @font-face {
                font-family: 'Noto Sans Hebrew';
                font-style: normal;
                font-weight: 400;
                src: url(${appSettings.hebrewFontUrlRegular}) format('truetype');
            }
            @font-face {
                font-family: 'Noto Sans Hebrew';
                font-style: normal;
                font-weight: 700;
                src: url(${appSettings.hebrewFontUrlBold}) format('truetype');
            }
        ` : `
            @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;700&display=swap');
        `;
        
        const fontFamily = isHebrew
            ? (appSettings.hebrewFontUrlRegular ? "'Noto Sans Hebrew', sans-serif" : "'Rubik', sans-serif")
            : "'Arial', sans-serif";

        const htmlContent = `
        <!DOCTYPE html>
        <html dir="${isHebrew ? 'rtl' : 'ltr'}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t('shoppingList', 'Shopping List')}</title>
            <style>
                ${fontFace}
                body { 
                    font-family: ${fontFamily}, sans-serif;
                    direction: ${isHebrew ? 'rtl' : 'ltr'};
                    padding: 20px;
                }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: ${isHebrew ? 'right' : 'left'}; }
                th { background-color: #f2f2f2; }
                h1 { text-align: center; }
            </style>
        </head>
        <body>
            <h1>${t('shoppingList', 'Shopping List')} - ${vendorName}</h1>
            <p>${t('date', 'Date')}: ${format(new Date(), 'yyyy-MM-dd')}</p>
            <table>
                <thead>
                    <tr>
                        <th>${t('product', 'Product')}</th>
                        <th>${t('quantity', 'Total Quantity')}</th>
                        <th>${t('unit', 'Unit')}</th>
                        <th>${t('ordersCount', '# of Orders')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${shoppingList.map(item => `
                        <tr>
                            <td>${isHebrew && item.name_hebrew ? item.name_hebrew : item.name}</td>
                            <td>${item.quantity}</td>
                            <td>${item.unit}</td>
                            <td>${item.ordersCount}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
        `;

        return new Response(htmlContent, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    } catch (error) {
        console.error("Error exporting shopping list HTML:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});