import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const driveToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
        const sheetsToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");

        const results = {
            drive: { success: false, message: '', details: null },
            sheets: { success: false, message: '', details: null }
        };

        // Test Google Drive Upload
        try {
            console.log('Testing Google Drive upload...');
            
            const testContent = 'This is a test file from Zoozz system test.';
            const boundary = '-------314159265358979323846';
            const delimiter = `\r\n--${boundary}\r\n`;
            const close_delim = `\r\n--${boundary}--`;

            const metadata = {
                name: `Test_Upload_${new Date().toISOString()}.txt`,
                mimeType: 'text/plain'
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: text/plain\r\n\r\n' +
                testContent +
                close_delim;

            const driveResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${driveToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartRequestBody
            });

            if (!driveResponse.ok) {
                const errorText = await driveResponse.text();
                results.drive.message = `Upload failed (${driveResponse.status})`;
                results.drive.details = errorText;
            } else {
                const driveResult = await driveResponse.json();
                results.drive.success = true;
                results.drive.message = 'File uploaded successfully';
                results.drive.details = {
                    fileId: driveResult.id,
                    fileName: driveResult.name
                };
            }
        } catch (error) {
            results.drive.message = `Error: ${error.message}`;
            results.drive.details = error.stack;
        }

        // Test Google Sheets Write
        try {
            console.log('Testing Google Sheets write...');
            
            const SPREADSHEET_ID = Deno.env.get("GOOGLE_SPREADSHEET_ID");
            if (!SPREADSHEET_ID) {
                results.sheets.message = 'GOOGLE_SPREADSHEET_ID not configured';
            } else {
                const SHEET_NAME = 'Orders';
                const testRowData = [
                    'TEST-ORDER',
                    'Test Household',
                    100,
                    10,
                    'ILS',
                    'test',
                    new Date().toISOString(),
                    '9999',
                    'test-vendor'
                ];

                const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}:append?valueInputOption=RAW`;
                
                const sheetsResponse = await fetch(sheetsUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sheetsToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: [testRowData]
                    })
                });

                if (!sheetsResponse.ok) {
                    const errorText = await sheetsResponse.text();
                    results.sheets.message = `Write failed (${sheetsResponse.status})`;
                    results.sheets.details = errorText;
                } else {
                    const sheetsResult = await sheetsResponse.json();
                    results.sheets.success = true;
                    results.sheets.message = 'Test row added successfully';
                    results.sheets.details = {
                        updatedRange: sheetsResult.updates?.updatedRange,
                        updatedRows: sheetsResult.updates?.updatedRows
                    };
                }
            }
        } catch (error) {
            results.sheets.message = `Error: ${error.message}`;
            results.sheets.details = error.stack;
        }

        return Response.json({ 
            success: true,
            results: results
        });

    } catch (error) {
        console.error('Test failed:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});